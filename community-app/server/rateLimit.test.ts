import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { RATE_LIMITS, enforceRateLimit, resetRateLimits } from "./_core/rateLimit";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function ctxFor(id = 1): TrpcContext {
  return {
    user: {
      id,
      email: "a@b.com",
      passwordHash: null,
      name: "20223 홍길동",
      loginMethod: "email",
      role: "user",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as AuthenticatedUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
});

describe("작성 속도 제한", () => {
  it("한도까지는 통과하고 그 다음부터 막는다", () => {
    const { max } = RATE_LIMITS.post;
    for (let i = 0; i < max; i++) {
      expect(() => enforceRateLimit("post", 1)).not.toThrow();
    }
    expect(() => enforceRateLimit("post", 1)).toThrow(RATE_LIMITS.post.message);
  });

  it("사용자마다 따로 센다 (한 명이 막혀도 다른 사람은 쓸 수 있다)", () => {
    for (let i = 0; i < RATE_LIMITS.post.max; i++) enforceRateLimit("post", 1);
    expect(() => enforceRateLimit("post", 1)).toThrow();
    expect(() => enforceRateLimit("post", 2)).not.toThrow();
  });

  it("종류마다 따로 센다 (글이 막혀도 댓글은 쓸 수 있다)", () => {
    for (let i = 0; i < RATE_LIMITS.post.max; i++) enforceRateLimit("post", 1);
    expect(() => enforceRateLimit("post", 1)).toThrow();
    expect(() => enforceRateLimit("comment", 1)).not.toThrow();
  });

  it("창이 지나면 다시 쓸 수 있다 (영구 차단이 아니다)", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMITS.post.max; i++) enforceRateLimit("post", 1, t0);
    expect(() => enforceRateLimit("post", 1, t0)).toThrow();

    // 창 길이를 막 넘긴 시점
    const later = t0 + RATE_LIMITS.post.windowMs + 1;
    expect(() => enforceRateLimit("post", 1, later)).not.toThrow();
  });

  it("슬라이딩 윈도우다 — 창 경계에서 한도의 두 배가 통과하지 않는다", () => {
    const t0 = 1_000_000;
    const { max, windowMs } = RATE_LIMITS.post;
    // 창 후반부를 한도만큼 채우고
    for (let i = 0; i < max; i++) enforceRateLimit("post", 1, t0 + windowMs - 100);
    // 창이 "바뀌었을" 법한 시점에도 아직 앞선 기록이 살아 있어야 한다
    expect(() => enforceRateLimit("post", 1, t0 + windowMs + 1)).toThrow();
  });
});

describe("글쓰기 라우터에 속도 제한이 걸려 있다", () => {
  it("연속으로 올리면 한도 초과로 막힌다", async () => {
    vi.spyOn(db, "createPost").mockResolvedValue({ insertId: 1 } as never);
    vi.spyOn(db, "getPostById").mockResolvedValue({ id: 1, userId: 1 } as never);
    vi.spyOn(db, "getPostAuthorId").mockResolvedValue(1);

    const caller = appRouter.createCaller(ctxFor());
    const input = { boardId: 1, title: "제목", content: "본문", isAnonymous: false };

    for (let i = 0; i < RATE_LIMITS.post.max; i++) {
      await caller.posts.create(input);
    }
    await expect(caller.posts.create(input)).rejects.toThrow(RATE_LIMITS.post.message);
  });
});

describe("중복 신고 방지", () => {
  it("같은 대상을 두 번 신고하면 거부한다", async () => {
    vi.spyOn(db, "hasReported").mockResolvedValue(true);
    const createReport = vi.spyOn(db, "createReport").mockResolvedValue({ id: 1 } as never);

    const caller = appRouter.createCaller(ctxFor());
    await expect(
      caller.reports.create({ targetType: "post", targetId: 1, reason: "스팸" })
    ).rejects.toThrow("이미 신고한 게시물입니다");

    expect(createReport).not.toHaveBeenCalled();
  });

  it("처음 신고는 통과한다", async () => {
    vi.spyOn(db, "hasReported").mockResolvedValue(false);
    const createReport = vi.spyOn(db, "createReport").mockResolvedValue({ id: 1 } as never);

    const caller = appRouter.createCaller(ctxFor());
    await caller.reports.create({ targetType: "post", targetId: 1, reason: "스팸" });

    expect(createReport).toHaveBeenCalled();
  });
});

describe("홈 화면 게시판 목록", () => {
  it("게시판과 최신 글을 한 번에 받는다 (게시판마다 따로 조회하지 않는다)", async () => {
    const spy = vi.spyOn(db, "getBoardsWithLatestPost").mockResolvedValue([] as never);
    const listByBoard = vi.spyOn(db, "getPostsByBoard").mockResolvedValue([] as never);

    const caller = appRouter.createCaller(ctxFor());
    await caller.boards.listWithLatest();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(listByBoard).not.toHaveBeenCalled();
  });
});
