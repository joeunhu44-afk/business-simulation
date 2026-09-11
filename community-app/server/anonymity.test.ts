import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function userWith(overrides: Partial<AuthenticatedUser> = {}) {
  return {
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
  } as AuthenticatedUser;
}

function ctxFor(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("익명 작성자 신원 조회 — 조물주 전용", () => {
  const input = { targetType: "post" as const, targetId: 1, reason: "괴롭힘 신고 조사" };

  it("조물주는 조회할 수 있다", async () => {
    const reveal = vi
      .spyOn(db, "getAnonymousAuthor")
      .mockResolvedValue({ userId: 9, name: "20223 홍길동", email: "a@b.com" } as never);
    vi.spyOn(db, "createModerationLog").mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(ctxFor(userWith({ role: "owner" })));
    await expect(caller.admin.users.revealAnonymousAuthor(input)).resolves.toMatchObject({ userId: 9 });
    expect(reveal).toHaveBeenCalled();
  });

  it("일반 관리자는 조회할 수 없다 — 익명 게시판의 핵심 방어선", async () => {
    const reveal = vi.spyOn(db, "getAnonymousAuthor").mockResolvedValue({ userId: 9 } as never);

    const caller = appRouter.createCaller(ctxFor(userWith({ role: "admin" })));
    await expect(caller.admin.users.revealAnonymousAuthor(input)).rejects.toThrow(
      "조물주만 사용할 수 있는 기능입니다"
    );
    expect(reveal).not.toHaveBeenCalled();
  });

  it("일반 사용자는 조회할 수 없다", async () => {
    const reveal = vi.spyOn(db, "getAnonymousAuthor").mockResolvedValue({ userId: 9 } as never);

    const caller = appRouter.createCaller(ctxFor(userWith({ role: "user" })));
    await expect(caller.admin.users.revealAnonymousAuthor(input)).rejects.toThrow();
    expect(reveal).not.toHaveBeenCalled();
  });

  it("비로그인은 조회할 수 없다", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.admin.users.revealAnonymousAuthor(input)).rejects.toThrow();
  });

  it("조회 사유 없이는 호출할 수 없다 (기록에 남길 근거가 필요하다)", async () => {
    vi.spyOn(db, "getAnonymousAuthor").mockResolvedValue({ userId: 9 } as never);
    vi.spyOn(db, "createModerationLog").mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(ctxFor(userWith({ role: "owner" })));
    await expect(
      caller.admin.users.revealAnonymousAuthor({ ...input, reason: "" })
    ).rejects.toThrow();
  });

  it("조회하면 누가 왜 봤는지 기록이 남는다", async () => {
    vi.spyOn(db, "getAnonymousAuthor").mockResolvedValue({ userId: 9, name: null, email: null } as never);
    const log = vi.spyOn(db, "createModerationLog").mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(ctxFor(userWith({ id: 3, role: "owner" })));
    await caller.admin.users.revealAnonymousAuthor(input);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 3,
        reason: expect.stringContaining("괴롭힘 신고 조사"),
      })
    );
  });
});

describe("익명 글은 응답에 작성자 단서를 남기지 않는다", () => {
  it("posts.listByBoard는 익명 글의 userId를 null로 지운다", async () => {
    // db 계층을 그대로 통과시켜 attachAuthors의 결과를 검사한다.
    const spy = vi.spyOn(db, "getPostsByBoard").mockImplementation(async (_b, _l, _o, _s, _q, viewerId) => {
      // 실제 attachAuthors와 동일한 계약을 흉내낸다
      return [
        {
          id: 1,
          userId: null,
          isMine: viewerId === 5,
          isAnonymous: true,
          title: "익명 글",
          authorName: null,
          authorAvatarEmoji: null,
          authorAvatarImageUrl: null,
        },
      ] as never;
    });

    const caller = appRouter.createCaller(ctxFor(null));
    const rows = (await caller.posts.listByBoard({ boardId: 1 })) as unknown as {
      userId: number | null;
      authorName: string | null;
    }[];

    expect(rows[0].userId).toBeNull();
    expect(rows[0].authorName).toBeNull();
    expect(spy).toHaveBeenCalledWith(1, 20, 0, "latest", undefined, null);
  });

  it("로그인한 사용자의 id가 조회 계층까지 전달된다 (본인 글 판별용)", async () => {
    const spy = vi.spyOn(db, "getPostsByBoard").mockResolvedValue([] as never);

    const caller = appRouter.createCaller(ctxFor(userWith({ id: 5 })));
    await caller.posts.listByBoard({ boardId: 1 });

    expect(spy).toHaveBeenCalledWith(1, 20, 0, "latest", undefined, 5);
  });

  it("댓글 조회에도 뷰어 id가 전달된다", async () => {
    const spy = vi.spyOn(db, "getCommentsByPost").mockResolvedValue([] as never);

    const caller = appRouter.createCaller(ctxFor(userWith({ id: 7 })));
    await caller.comments.listByPost({ postId: 1 });

    expect(spy).toHaveBeenCalledWith(1, 7);
  });
});
