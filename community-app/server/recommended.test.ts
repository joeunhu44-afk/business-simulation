import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function loggedInUser(id: number): AuthenticatedUser {
  return {
    id,
    email: `user${id}@example.com`,
    passwordHash: null,
    name: "20223 테스터",
    loginMethod: "email",
    role: "user",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as AuthenticatedUser;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("posts.recommended", () => {
  it("비로그인 사용자는 userId 없이(=인기글로) 조회한다", async () => {
    const spy = vi.spyOn(db, "getRecommendedPosts").mockResolvedValue([] as never);

    const caller = appRouter.createCaller(createContext(null));
    await caller.posts.recommended({ limit: 5 });

    expect(spy).toHaveBeenCalledWith(null, 5);
  });

  it("로그인 사용자는 자신의 id로 조회한다 (개인화 판단은 서버가 한다)", async () => {
    const spy = vi.spyOn(db, "getRecommendedPosts").mockResolvedValue([] as never);

    const caller = appRouter.createCaller(createContext(loggedInUser(42)));
    await caller.posts.recommended({ limit: 5 });

    expect(spy).toHaveBeenCalledWith(42, 5);
  });

  it("입력을 생략하면 기본 5개를 요청한다", async () => {
    const spy = vi.spyOn(db, "getRecommendedPosts").mockResolvedValue([] as never);

    const caller = appRouter.createCaller(createContext(null));
    await caller.posts.recommended();

    expect(spy).toHaveBeenCalledWith(null, 5);
  });

  it("추천할 글이 없으면 빈 배열을 그대로 돌려준다 (홈에서 영역이 숨겨진다)", async () => {
    vi.spyOn(db, "getRecommendedPosts").mockResolvedValue([] as never);

    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.posts.recommended({ limit: 5 })).resolves.toEqual([]);
  });

  it("limit 상한을 넘기면 거부한다", async () => {
    vi.spyOn(db, "getRecommendedPosts").mockResolvedValue([] as never);

    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.posts.recommended({ limit: 50 })).rejects.toThrow();
  });
});
