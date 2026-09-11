import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "./context";
import * as db from "../db";
import { BLOCKED_MESSAGE, checkContent, normalizeAggressive, normalizeBasic } from "./moderation";
import { resetRateLimits } from "./rateLimit";

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

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
});

describe("정규화", () => {
  it("공백·특수문자를 지우고 반복 문자를 줄인다", () => {
    expect(normalizeBasic("시 발")).toBe("시발");
    expect(normalizeBasic("시-발")).toBe("시발");
    expect(normalizeBasic("ㅋㅋㅋㅋ")).toBe("ㅋ");
  });

  it("강한 정규화는 숫자를 지우고 된소리·유사 모음을 통일한다", () => {
    expect(normalizeAggressive("시1발")).toBe("시발");
    expect(normalizeAggressive("씨발")).toBe("시발"); // ㅆ → ㅅ
    expect(normalizeAggressive("시빨")).toBe("시발"); // ㅃ → ㅂ
    expect(normalizeAggressive("씨빨")).toBe("시발");
    expect(normalizeAggressive("엠창")).toBe("앰창"); // ㅔ → ㅐ
  });
});

describe("checkContent — 정상 문장은 통과", () => {
  // 오탐이 나면 커뮤니티 이용이 크게 불편해지므로 가장 중요한 케이스다.
  const benign = [
    "시발점", // "시발"을 포함하지만 정상 단어
    "개발자가 되고 싶어요",
    "오늘 회식 있어요",
    "시바견 너무 귀여워",
    "발표 자료 준비했어요",
    "세끼 다 먹었어요",
    "다시 이발했어",
    "8시 발표입니다",
    "강아지 새끼 분양합니다",
    "고양이 새끼 귀엽다",
    "새끼손가락 걸고 약속",
    "무시발언 하지 마세요",
    "일시불로 결제할게요",
    "임시방편이야",
    "피시방 갈 사람?",
    "오늘 급식 진짜 맛있었다",
    "시험 범위 어디까지인가요",
    "ㅋㅋㅋ 진짜 웃기다",
  ];

  it.each(benign)("%s → 통과", async (text) => {
    const result = await checkContent(text);
    expect(result.blocked).toBe(false);
  });
});

describe("checkContent — 직설적인 비속어는 차단", () => {
  const profanity = ["시발", "씨발", "개새끼", "병신", "지랄", "좆같네", "미친놈", "느금마", "존나"];

  it.each(profanity)("%s → 차단", async (text) => {
    const result = await checkContent(text);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBeTruthy();
  });
});

describe("checkContent — 우회 표현도 차단", () => {
  const evasions = [
    "시 발", // 공백 삽입
    "시-발", // 특수문자 삽입
    "시.발",
    "시1발", // 숫자 삽입
    "씨1발",
    "시이발", // 모음 삽입
    "시이이이발", // 반복
    "시이빨", // 된소리 우회
    "ㅅㅂ", // 초성체
    "ㅆㅂ",
    "ㅄ",
    "아 씨발 진짜 짜증나",
    "야 이 시1발아",
  ];

  it.each(evasions)("%s → 차단", async (text) => {
    const result = await checkContent(text);
    expect(result.blocked).toBe(true);
  });
});

describe("checkContent — 허용 목록 악용 방지", () => {
  // 허용 목록에 있는 정상 단어를 끼워 넣어 필터를 통과하려는 시도를 막는다.
  const tricky = [
    "시발점에서 시발",
    "이발소 갔다가 씨발",
    "강아지 새끼랑 개새끼는 다르지",
    "8시 발표인데 시발 준비 안됨",
    "개세끼",
  ];

  it.each(tricky)("%s → 차단", async (text) => {
    const result = await checkContent(text);
    expect(result.blocked).toBe(true);
  });
});

describe("checkContent — 어느 단계에서 걸렸는지 기록", () => {
  it("korcen이 잡으면 korcen으로 기록한다", async () => {
    const result = await checkContent("시발");
    expect(result.reason).toContain("korcen");
  });

  it("korcen이 놓친 표현은 커스텀 목록으로 기록한다", async () => {
    // korcen 1.0.1은 "씨발"을 잡지 못한다 — 커스텀 목록이 받아낸다
    const result = await checkContent("씨발");
    expect(result.reason).toContain("커스텀 금지어");
  });
});

describe("checkContent — 장애 시 통과(fail-open)", () => {
  it("검사 중 예외가 나도 글 작성을 막지 않는다", async () => {
    // 정규화 단계에서 예외를 던지게 만들어 필터 장애 상황을 재현한다
    const broken = { normalize: () => { throw new Error("boom"); } } as unknown as string;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await checkContent(broken);

    expect(result.blocked).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it("빈 문자열에도 예외를 던지지 않는다", async () => {
    await expect(checkContent("")).resolves.toEqual({ blocked: false });
    await expect(checkContent("   ")).resolves.toEqual({ blocked: false });
  });
});

describe("posts.create / comments.create 연동", () => {
  it("위반 게시글은 저장하지 않고 거부한다", async () => {
    const createPost = vi.spyOn(db, "createPost");
    vi.spyOn(db, "createModerationLog").mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createAuthContext());

    await expect(
      caller.posts.create({ boardId: 1, title: "제목", content: "이 씨발 뭐야", isAnonymous: false, images: [] })
    ).rejects.toThrow(BLOCKED_MESSAGE);
    expect(createPost).not.toHaveBeenCalled();
  });

  it("차단 사유를 사용자에게 노출하지 않는다", async () => {
    vi.spyOn(db, "createModerationLog").mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createAuthContext());

    await expect(
      caller.posts.create({ boardId: 1, title: "제목", content: "이 씨발 뭐야", isAnonymous: false, images: [] })
    ).rejects.toThrow(expect.not.stringContaining("씨발") as never);
  });

  it("차단된 시도를 관리자용 기록으로 남긴다", async () => {
    const createLog = vi.spyOn(db, "createModerationLog").mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createAuthContext(7));

    await expect(
      caller.posts.create({ boardId: 3, title: "제목", content: "씨발", isAnonymous: false, images: [] })
    ).rejects.toThrow();

    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, targetType: "post", boardId: 3, reason: expect.stringContaining("커스텀") })
    );
  });

  it("기록 저장이 실패해도 차단 응답은 정상적으로 나간다", async () => {
    vi.spyOn(db, "createModerationLog").mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const caller = appRouter.createCaller(createAuthContext());

    await expect(
      caller.posts.create({ boardId: 1, title: "제목", content: "씨발", isAnonymous: false, images: [] })
    ).rejects.toThrow(BLOCKED_MESSAGE);
  });

  it("정상 게시글은 그대로 저장한다", async () => {
    const createPost = vi.spyOn(db, "createPost").mockResolvedValue([{ insertId: 42 }] as never);
    const createLog = vi.spyOn(db, "createModerationLog").mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createAuthContext());

    await caller.posts.create({
      boardId: 1,
      title: "오늘 급식 후기",
      content: "정말 맛있었어요",
      isAnonymous: false,
      images: [],
    });

    expect(createPost).toHaveBeenCalled();
    expect(createLog).not.toHaveBeenCalled();
  });

  it("위반 댓글은 저장하지 않고 거부한다", async () => {
    const createComment = vi.spyOn(db, "createComment");
    vi.spyOn(db, "createModerationLog").mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createAuthContext());

    await expect(
      caller.comments.create({ postId: 1, content: "ㅅㅂ 뭐래", isAnonymous: false })
    ).rejects.toThrow(BLOCKED_MESSAGE);
    expect(createComment).not.toHaveBeenCalled();
  });

  it("정상 댓글은 그대로 저장한다", async () => {
    const createComment = vi.spyOn(db, "createComment").mockResolvedValue([{ insertId: 7 }] as never);
    const caller = appRouter.createCaller(createAuthContext());

    await caller.comments.create({ postId: 1, content: "좋은 정보 감사합니다", isAnonymous: false });

    expect(createComment).toHaveBeenCalled();
  });
});
