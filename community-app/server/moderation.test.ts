import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";
import * as db from "./db";
import { AUTO_REPORT_REASON, BLOCKED_MESSAGE, moderateContent, normalizeText } from "./moderation";
import { SYSTEM_REPORTER_USER_ID } from "@shared/const";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    email: `user${userId}@example.com`,
    passwordHash: null,
    name: `2022${userId} 테스터`,
    loginMethod: "email",
    role: "user",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

/** category_scores만 담은 최소한의 Moderation API 응답. */
function moderationResponse(scores: Record<string, number>) {
  return {
    ok: true,
    json: async () => ({ results: [{ category_scores: scores }] }),
  } as Response;
}

const originalApiKey = ENV.openaiApiKey;

afterEach(() => {
  ENV.openaiApiKey = originalApiKey;
  vi.restoreAllMocks();
});

describe("normalizeText", () => {
  it("공백·특수문자를 지우고 반복 문자를 줄인다", () => {
    expect(normalizeText("시 발")).toBe("시발");
    expect(normalizeText("시.발")).toBe("시발");
    expect(normalizeText("ㅋㅋㅋㅋㅋ")).toBe("ㅋㅋ");
  });
});

describe("moderateContent — 키워드 필터", () => {
  beforeEach(() => {
    // AI 검사 없이 키워드 필터만 동작하는 상태
    ENV.openaiApiKey = "";
  });

  it("정상적인 글은 통과시킨다", async () => {
    const verdict = await moderateContent("오늘 급식 진짜 맛있었어요. 다들 드셔보세요!");
    expect(verdict.action).toBe("allow");
  });

  it("비속어가 들어간 글은 차단한다", async () => {
    const verdict = await moderateContent("이 시발 뭐야");
    expect(verdict).toEqual({ action: "block", userMessage: BLOCKED_MESSAGE });
  });

  it("특수문자·숫자를 끼워 넣은 우회 표현도 잡는다", async () => {
    for (const evasion of ["시*발", "시.발", "시1발", "씨 발", "개 새 끼"]) {
      const verdict = await moderateContent(`왜 이래 ${evasion} 진짜`);
      expect(verdict.action, evasion).toBe("block");
    }
  });

  it("자음만 쓴 초성체도 잡는다", async () => {
    const verdict = await moderateContent("ㅋㅋㅋ ㅅㅂ 개웃기네");
    expect(verdict.action).toBe("block");
  });

  it("차단 안내에 어떤 단어가 걸렸는지 노출하지 않는다", async () => {
    const verdict = await moderateContent("이 시발 뭐야");
    if (verdict.action !== "block") throw new Error("차단됐어야 합니다");
    expect(verdict.userMessage).not.toContain("시발");
  });

  it("정상 문맥에 우연히 섞일 수 있는 표현은 차단하지 않는다", async () => {
    for (const text of [
      "강아지 새끼가 너무 귀여워요",
      "어제는 시험을 보지 못했어요",
      "쓰레기 분리수거 당번이 누구인가요",
      "시바견 키우는 사람 있나요",
    ]) {
      const verdict = await moderateContent(text);
      expect(verdict.action, text).toBe("allow");
    }
  });

  it("주의 표현은 차단하지 않고 검토 대상으로 넘긴다", async () => {
    const verdict = await moderateContent("이거 존나 어렵다");
    expect(verdict.action).toBe("review");
  });
});

describe("moderateContent — Moderation API", () => {
  beforeEach(() => {
    ENV.openaiApiKey = "test-key";
  });

  it("심각한 카테고리 점수가 높으면 차단한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      moderationResponse({ "harassment/threatening": 0.95, harassment: 0.9 })
    );

    const verdict = await moderateContent("평범해 보이지만 위협적인 문장");
    expect(verdict.action).toBe("block");
  });

  it("중간 점수는 차단하지 않고 검토로 넘긴다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(moderationResponse({ harassment: 0.6 }));

    const verdict = await moderateContent("좀 애매한 문장");
    expect(verdict.action).toBe("review");
  });

  it("점수가 낮으면 통과시킨다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(moderationResponse({ harassment: 0.01 }));

    const verdict = await moderateContent("오늘 날씨 좋네요");
    expect(verdict.action).toBe("allow");
  });

  it("차단 카테고리가 아니면 점수가 아주 높아도 차단하지 않고 검토로만 넘긴다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(moderationResponse({ harassment: 0.99 }));

    const verdict = await moderateContent("공격적으로 들릴 수 있는 문장");
    expect(verdict.action).toBe("review");
  });

  it("API 호출이 실패해도 글 작성을 막지 않는다", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const verdict = await moderateContent("정상적인 글입니다");

    expect(verdict.action).toBe("allow");
    expect(warn).toHaveBeenCalled();
  });

  it("API가 오류 응답을 줘도 글 작성을 막지 않는다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 500 } as Response);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const verdict = await moderateContent("정상적인 글입니다");
    expect(verdict.action).toBe("allow");
  });

  it("API가 통과시켜도 키워드 필터가 잡은 글은 차단한다", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(moderationResponse({ harassment: 0 }));

    const verdict = await moderateContent("이 시발 뭐야");

    expect(verdict.action).toBe("block");
    // 키워드에서 이미 차단됐으므로 API를 부를 필요도 없다
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("posts.create / comments.create 연동", () => {
  beforeEach(() => {
    ENV.openaiApiKey = "";
  });

  it("위반 게시글은 저장하지 않고 거부한다", async () => {
    const createPost = vi.spyOn(db, "createPost");
    const caller = appRouter.createCaller(createAuthContext());

    await expect(
      caller.posts.create({ boardId: 1, title: "제목", content: "이 시발 뭐야", isAnonymous: false, images: [] })
    ).rejects.toThrow(BLOCKED_MESSAGE);
    expect(createPost).not.toHaveBeenCalled();
  });

  it("제목에만 비속어가 있어도 거부한다", async () => {
    const createPost = vi.spyOn(db, "createPost");
    const caller = appRouter.createCaller(createAuthContext());

    await expect(
      caller.posts.create({ boardId: 1, title: "개새끼들아", content: "평범한 본문", isAnonymous: false, images: [] })
    ).rejects.toThrow(BLOCKED_MESSAGE);
    expect(createPost).not.toHaveBeenCalled();
  });

  it("정상 게시글은 저장하고 자동 신고를 남기지 않는다", async () => {
    const createPost = vi.spyOn(db, "createPost").mockResolvedValue([{ insertId: 42 }] as never);
    const createReport = vi.spyOn(db, "createReport").mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createAuthContext());

    await caller.posts.create({
      boardId: 1,
      title: "오늘 급식 후기",
      content: "정말 맛있었어요",
      isAnonymous: false,
      images: [],
    });

    expect(createPost).toHaveBeenCalled();
    expect(createReport).not.toHaveBeenCalled();
  });

  it("애매한 게시글은 게시하되 시스템 자동 신고로 등록한다", async () => {
    vi.spyOn(db, "createPost").mockResolvedValue([{ insertId: 42 }] as never);
    const createReport = vi.spyOn(db, "createReport").mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createAuthContext());

    await caller.posts.create({
      boardId: 1,
      title: "질문",
      content: "이거 존나 어렵다",
      isAnonymous: false,
      images: [],
    });

    expect(createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterUserId: SYSTEM_REPORTER_USER_ID,
        targetType: "post",
        targetId: 42,
        reason: AUTO_REPORT_REASON,
      })
    );
  });

  it("위반 댓글은 저장하지 않고 거부한다", async () => {
    const createComment = vi.spyOn(db, "createComment");
    const caller = appRouter.createCaller(createAuthContext());

    await expect(
      caller.comments.create({ postId: 1, content: "ㅅㅂ 뭐래", isAnonymous: false })
    ).rejects.toThrow(BLOCKED_MESSAGE);
    expect(createComment).not.toHaveBeenCalled();
  });

  it("애매한 댓글은 게시하되 시스템 자동 신고로 등록한다", async () => {
    vi.spyOn(db, "createComment").mockResolvedValue([{ insertId: 7 }] as never);
    const createReport = vi.spyOn(db, "createReport").mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createAuthContext());

    await caller.comments.create({ postId: 1, content: "존나 신기하네", isAnonymous: false });

    expect(createReport).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: "comment", targetId: 7, reason: AUTO_REPORT_REASON })
    );
  });

  it("정상 댓글은 그대로 저장한다", async () => {
    const createComment = vi.spyOn(db, "createComment").mockResolvedValue([{ insertId: 7 }] as never);
    const createReport = vi.spyOn(db, "createReport").mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createAuthContext());

    await caller.comments.create({ postId: 1, content: "좋은 정보 감사합니다", isAnonymous: false });

    expect(createComment).toHaveBeenCalled();
    expect(createReport).not.toHaveBeenCalled();
  });
});
