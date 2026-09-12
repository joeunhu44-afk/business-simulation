import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import {
  FAVORITE_WEIGHT,
  buildBoardAffinity,
  affinityMultiplier,
  hasEnoughActivity,
  rankPosts,
} from "./_core/ranking";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function ctxFor(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      email: "a@b.com",
      passwordHash: null,
      name: "20223 홍길동",
      loginMethod: "email",
      role: "user",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    } as AuthenticatedUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const anonCtx: TrpcContext = {
  user: null,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: { cookie: () => {} } as unknown as TrpcContext["res"],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("게시판 즐겨찾기", () => {
  it("즐겨찾기를 켜고 끌 수 있다", async () => {
    vi.spyOn(db, "getBoardById").mockResolvedValue({ id: 7 } as never);
    const toggle = vi.spyOn(db, "toggleBoardFavorite").mockResolvedValue({ favorited: true });

    const caller = appRouter.createCaller(ctxFor({ id: 42 }));
    await expect(caller.boards.toggleFavorite({ boardId: 7 })).resolves.toEqual({ favorited: true });

    expect(toggle).toHaveBeenCalledWith(42, 7);
  });

  it("없는 게시판은 거부한다", async () => {
    vi.spyOn(db, "getBoardById").mockResolvedValue(undefined);
    const toggle = vi.spyOn(db, "toggleBoardFavorite").mockResolvedValue({ favorited: true });

    const caller = appRouter.createCaller(ctxFor());
    await expect(caller.boards.toggleFavorite({ boardId: 999 })).rejects.toThrow(
      "게시판을 찾을 수 없습니다"
    );
    expect(toggle).not.toHaveBeenCalled();
  });

  it("비로그인은 즐겨찾기할 수 없다", async () => {
    const caller = appRouter.createCaller(anonCtx);
    await expect(caller.boards.toggleFavorite({ boardId: 7 })).rejects.toThrow();
  });

  it("승인 대기 중이어도 즐겨찾기는 된다 (내 화면 정렬일 뿐이다)", async () => {
    vi.spyOn(db, "getBoardById").mockResolvedValue({ id: 7 } as never);
    vi.spyOn(db, "toggleBoardFavorite").mockResolvedValue({ favorited: true });

    const caller = appRouter.createCaller(ctxFor({ status: "pending" }));
    await expect(caller.boards.toggleFavorite({ boardId: 7 })).resolves.toEqual({ favorited: true });
  });

  it("홈 목록은 보는 사람 기준으로 즐겨찾기를 채운다", async () => {
    const spy = vi.spyOn(db, "getBoardsWithLatestPost").mockResolvedValue([] as never);

    await appRouter.createCaller(ctxFor({ id: 42 })).boards.listWithLatest();
    expect(spy).toHaveBeenCalledWith(42);

    await appRouter.createCaller(anonCtx).boards.listWithLatest();
    expect(spy).toHaveBeenCalledWith(null);
  });
});

describe("즐겨찾기가 추천 알고리즘에 미치는 영향", () => {
  const noActivity = { likedBoardIds: [], authoredBoardIds: [], commentedBoardIds: [] };

  it("즐겨찾기 한 번이 댓글이나 작성보다 무겁다 (짐작이 아니라 본인이 고른 신호)", () => {
    const affinity = buildBoardAffinity({
      likedBoardIds: [],
      authoredBoardIds: [2],
      commentedBoardIds: [3],
      favoritedBoardIds: [1],
    });

    expect(affinity.get(1)).toBe(FAVORITE_WEIGHT);
    expect(affinity.get(1)!).toBeGreaterThan(affinity.get(2)!);
    expect(affinity.get(1)!).toBeGreaterThan(affinity.get(3)!);
  });

  it("활동이 전혀 없어도 즐겨찾기 하나면 개인화가 켜진다", () => {
    expect(hasEnoughActivity(noActivity)).toBe(false);
    expect(hasEnoughActivity({ ...noActivity, favoritedBoardIds: [1] })).toBe(true);
  });

  it("즐겨찾기가 없으면 기존대로 활동 3건이 필요하다", () => {
    expect(hasEnoughActivity({ ...noActivity, favoritedBoardIds: [] })).toBe(false);
    expect(hasEnoughActivity({ likedBoardIds: [1, 2], authoredBoardIds: [1], commentedBoardIds: [] })).toBe(true);
  });

  it("즐겨찾기한 게시판 글이 같은 반응이면 위로 올라온다", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const createdAt = new Date("2026-01-01T10:00:00Z");
    const candidates = [
      { id: 1, boardId: 99, likeCount: 5, commentCount: 1, viewCount: 10, createdAt },
      { id: 2, boardId: 1, likeCount: 5, commentCount: 1, viewCount: 10, createdAt },
    ];

    const affinity = buildBoardAffinity({ ...noActivity, favoritedBoardIds: [1] });
    const ranked = rankPosts(candidates, { now, affinity, limit: 2 });

    expect(ranked[0].id).toBe(2);
  });

  it("즐겨찾기해도 반응이 압도적인 글을 밀어내지는 못한다 (추천이지 '내 게시판 최신글'이 아니다)", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const createdAt = new Date("2026-01-01T10:00:00Z");
    const candidates = [
      // 커뮤니티 전체가 반응한 글
      { id: 1, boardId: 99, likeCount: 100, commentCount: 40, viewCount: 500, createdAt },
      // 즐겨찾기 게시판이지만 반응이 거의 없는 글
      { id: 2, boardId: 1, likeCount: 1, commentCount: 0, viewCount: 2, createdAt },
    ];

    const affinity = buildBoardAffinity({ ...noActivity, favoritedBoardIds: [1] });
    const ranked = rankPosts(candidates, { now, affinity, limit: 2 });

    expect(ranked[0].id).toBe(1);
  });

  it("가산 배율에 상한이 있다", () => {
    const affinity = buildBoardAffinity({ ...noActivity, favoritedBoardIds: [1, 1, 1, 1, 1] });
    expect(affinityMultiplier(1, affinity)).toBeLessThanOrEqual(1.5);
  });
});
