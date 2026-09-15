import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

const anonCtx: TrpcContext = {
  user: null,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: { cookie: () => {} } as unknown as TrpcContext["res"],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("통합 검색", () => {
  it("전체는 게시판과 게시글을 모두 찾는다", async () => {
    const boards = vi.spyOn(db, "searchBoards").mockResolvedValue([{ id: 1 }] as never);
    const posts = vi.spyOn(db, "searchPosts").mockResolvedValue([{ id: 9 }] as never);

    const result = await appRouter.createCaller(anonCtx).search.all({ query: "시험" });

    expect(boards).toHaveBeenCalled();
    expect(posts).toHaveBeenCalled();
    expect(result.boards).toHaveLength(1);
    expect(result.posts).toHaveLength(1);
  });

  it("게시판만 고르면 게시글은 아예 조회하지 않는다", async () => {
    const boards = vi.spyOn(db, "searchBoards").mockResolvedValue([] as never);
    const posts = vi.spyOn(db, "searchPosts").mockResolvedValue([] as never);

    await appRouter.createCaller(anonCtx).search.all({ query: "시험", type: "boards" });

    expect(boards).toHaveBeenCalled();
    expect(posts).not.toHaveBeenCalled();
  });

  it("게시글만 고르면 게시판은 아예 조회하지 않는다", async () => {
    const boards = vi.spyOn(db, "searchBoards").mockResolvedValue([] as never);
    const posts = vi.spyOn(db, "searchPosts").mockResolvedValue([] as never);

    await appRouter.createCaller(anonCtx).search.all({ query: "시험", type: "posts" });

    expect(posts).toHaveBeenCalled();
    expect(boards).not.toHaveBeenCalled();
  });

  it("전체에서는 게시판을 맛보기로만 보여준다 (자리를 게시글에 내준다)", async () => {
    const boards = vi.spyOn(db, "searchBoards").mockResolvedValue([] as never);
    vi.spyOn(db, "searchPosts").mockResolvedValue([] as never);

    await appRouter.createCaller(anonCtx).search.all({ query: "시험", limit: 20 });
    expect(boards).toHaveBeenCalledWith("시험", 5);

    boards.mockClear();
    await appRouter.createCaller(anonCtx).search.all({ query: "시험", type: "boards", limit: 20 });
    expect(boards).toHaveBeenCalledWith("시험", 20);
  });

  it("앞뒤 공백은 떼고 검색한다", async () => {
    const boards = vi.spyOn(db, "searchBoards").mockResolvedValue([] as never);
    vi.spyOn(db, "searchPosts").mockResolvedValue([] as never);

    await appRouter.createCaller(anonCtx).search.all({ query: "  시험  " });

    expect(boards).toHaveBeenCalledWith("시험", 5);
  });

  it("공백만 입력하면 아무것도 조회하지 않는다", async () => {
    const boards = vi.spyOn(db, "searchBoards").mockResolvedValue([] as never);
    const posts = vi.spyOn(db, "searchPosts").mockResolvedValue([] as never);

    const result = await appRouter.createCaller(anonCtx).search.all({ query: "   " });

    expect(result).toEqual({ boards: [], posts: [] });
    expect(boards).not.toHaveBeenCalled();
    expect(posts).not.toHaveBeenCalled();
  });

  it("빈 검색어는 거부한다", async () => {
    await expect(appRouter.createCaller(anonCtx).search.all({ query: "" })).rejects.toThrow();
  });

  it("비로그인도 검색할 수 있다 (둘러보기가 막히면 안 된다)", async () => {
    vi.spyOn(db, "searchBoards").mockResolvedValue([] as never);
    const posts = vi.spyOn(db, "searchPosts").mockResolvedValue([] as never);

    await appRouter.createCaller(anonCtx).search.all({ query: "시험" });

    // viewerId가 null로 넘어가야 익명 글의 작성자가 드러나지 않는다
    expect(posts).toHaveBeenCalledWith("시험", 20, 0, null);
  });
});
