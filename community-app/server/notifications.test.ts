import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { ENV } from "./_core/env";

// auth.signup은 세션 쿠키를 발급하므로 테스트에서도 서명 키가 필요하다.
ENV.cookieSecret = ENV.cookieSecret || "test-secret-for-notifications-spec";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    email: "user1@example.com",
    passwordHash: null,
    name: "20221 테스터",
    loginMethod: "email",
    role: "user",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  } as AuthenticatedUser;

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    // issueSession()이 res.cookie를 호출하므로 스텁을 넣어둔다
    res: { cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("회원가입 시 알림 수신 동의", () => {
  it("동의하지 않아도 가입된다 (기본값 미동의)", async () => {
    const createUser = vi
      .spyOn(db, "createUserWithPassword")
      .mockResolvedValue({ id: 5 } as never);
    vi.spyOn(db, "getUserByEmail").mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(createContext());
    await caller.auth.signup({ email: "a@b.com", password: "1234", name: "20223 홍길동" });

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ notifyPost: false, notifyMarketing: false })
    );
  });

  it("동의한 항목만 true로 저장된다", async () => {
    const createUser = vi
      .spyOn(db, "createUserWithPassword")
      .mockResolvedValue({ id: 5 } as never);
    vi.spyOn(db, "getUserByEmail").mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(createContext());
    await caller.auth.signup({
      email: "a@b.com",
      password: "1234",
      name: "20223 홍길동",
      notifyPost: true,
      notifyMarketing: false,
    });

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ notifyPost: true, notifyMarketing: false })
    );
  });
});

describe("알림 수신 동의 변경", () => {
  it("설정에서 동의를 켜고 끌 수 있다", async () => {
    const update = vi.spyOn(db, "updateNotificationPrefs").mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createContext({ id: 9 }));

    await caller.auth.updateNotificationPrefs({ notifyMarketing: true });

    expect(update).toHaveBeenCalledWith(9, { notifyMarketing: true });
  });

  it("로그인하지 않으면 변경할 수 없다", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(caller.auth.updateNotificationPrefs({ notifyPost: true })).rejects.toThrow();
  });
});

describe("활동 알림 생성", () => {
  const post = { id: 10, userId: 2, title: "내 글 제목" };

  it("동의한 글쓴이에게 댓글 알림이 간다", async () => {
    vi.spyOn(db, "createComment").mockResolvedValue([{ insertId: 1 }] as never);
    vi.spyOn(db, "getPostById").mockResolvedValue(post as never);
    // 익명 글은 getPostById가 userId를 지우므로 알림 대상은 내부 조회로 읽는다.
    vi.spyOn(db, "getPostAuthorId").mockResolvedValue(post.userId);
    vi.spyOn(db, "hasPostNotifyConsent").mockResolvedValue(true);
    const createNotification = vi.spyOn(db, "createNotification").mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(createContext({ id: 1 }));
    await caller.comments.create({ postId: 10, content: "좋은 글이네요", isAnonymous: false });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 2, type: "post_comment", linkUrl: "/post/10" })
    );
  });

  it("동의하지 않은 글쓴이에게는 알림이 가지 않는다", async () => {
    vi.spyOn(db, "createComment").mockResolvedValue([{ insertId: 1 }] as never);
    vi.spyOn(db, "getPostById").mockResolvedValue(post as never);
    // 익명 글은 getPostById가 userId를 지우므로 알림 대상은 내부 조회로 읽는다.
    vi.spyOn(db, "getPostAuthorId").mockResolvedValue(post.userId);
    vi.spyOn(db, "hasPostNotifyConsent").mockResolvedValue(false);
    const createNotification = vi.spyOn(db, "createNotification").mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(createContext({ id: 1 }));
    await caller.comments.create({ postId: 10, content: "좋은 글이네요", isAnonymous: false });

    expect(createNotification).not.toHaveBeenCalled();
  });

  it("내 글에 내가 댓글을 달면 알림이 가지 않는다", async () => {
    vi.spyOn(db, "createComment").mockResolvedValue([{ insertId: 1 }] as never);
    vi.spyOn(db, "getPostById").mockResolvedValue(post as never);
    // 익명 글은 getPostById가 userId를 지우므로 알림 대상은 내부 조회로 읽는다.
    vi.spyOn(db, "getPostAuthorId").mockResolvedValue(post.userId);
    const consent = vi.spyOn(db, "hasPostNotifyConsent").mockResolvedValue(true);
    const createNotification = vi.spyOn(db, "createNotification").mockResolvedValue(undefined as never);

    // 글쓴이(userId 2) 본인이 댓글 작성
    const caller = appRouter.createCaller(createContext({ id: 2 }));
    await caller.comments.create({ postId: 10, content: "자답", isAnonymous: false });

    expect(createNotification).not.toHaveBeenCalled();
    expect(consent).not.toHaveBeenCalled();
  });

  it("좋아요를 누르면 글쓴이에게 알림이 간다", async () => {
    vi.spyOn(db, "hasUserLikedPost").mockResolvedValue(false as never);
    vi.spyOn(db, "addPostLike").mockResolvedValue(undefined as never);
    vi.spyOn(db, "getPostById").mockResolvedValue(post as never);
    // 익명 글은 getPostById가 userId를 지우므로 알림 대상은 내부 조회로 읽는다.
    vi.spyOn(db, "getPostAuthorId").mockResolvedValue(post.userId);
    vi.spyOn(db, "hasPostNotifyConsent").mockResolvedValue(true);
    const createNotification = vi.spyOn(db, "createNotification").mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(createContext({ id: 1 }));
    await caller.likes.togglePostLike({ postId: 10 });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 2, type: "post_like" })
    );
  });

  it("좋아요를 취소할 때는 알림이 가지 않는다", async () => {
    vi.spyOn(db, "hasUserLikedPost").mockResolvedValue(true as never);
    vi.spyOn(db, "removePostLike").mockResolvedValue(undefined as never);
    const createNotification = vi.spyOn(db, "createNotification").mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(createContext({ id: 1 }));
    await caller.likes.togglePostLike({ postId: 10 });

    expect(createNotification).not.toHaveBeenCalled();
  });

  it("알림 생성이 실패해도 댓글 작성 자체는 성공한다", async () => {
    vi.spyOn(db, "createComment").mockResolvedValue([{ insertId: 1 }] as never);
    vi.spyOn(db, "getPostById").mockResolvedValue(post as never);
    // 익명 글은 getPostById가 userId를 지우므로 알림 대상은 내부 조회로 읽는다.
    vi.spyOn(db, "getPostAuthorId").mockResolvedValue(post.userId);
    vi.spyOn(db, "hasPostNotifyConsent").mockResolvedValue(true);
    vi.spyOn(db, "createNotification").mockRejectedValue(new Error("db down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const caller = appRouter.createCaller(createContext({ id: 1 }));
    await expect(
      caller.comments.create({ postId: 10, content: "좋은 글이네요", isAnonymous: false })
    ).resolves.toBeDefined();
    expect(warn).toHaveBeenCalled();
  });
});

describe("알림함", () => {
  it("본인 알림만 조회한다", async () => {
    const getNotifications = vi.spyOn(db, "getNotifications").mockResolvedValue([] as never);
    const caller = appRouter.createCaller(createContext({ id: 7 }));

    await caller.notifications.list({ limit: 30, offset: 0 });

    expect(getNotifications).toHaveBeenCalledWith(7, 30, 0);
  });

  it("읽음 처리에 본인 userId가 함께 전달된다 (남의 알림 보호)", async () => {
    const markRead = vi.spyOn(db, "markNotificationRead").mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createContext({ id: 7 }));

    await caller.notifications.markRead({ id: 123 });

    expect(markRead).toHaveBeenCalledWith(123, 7);
  });

  it("로그인하지 않으면 알림함을 볼 수 없다", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(caller.notifications.list({ limit: 30, offset: 0 })).rejects.toThrow();
  });
});

describe("광고성 알림 발송", () => {
  it("일반 사용자는 발송할 수 없다", async () => {
    const caller = appRouter.createCaller(createContext({ role: "user" }));

    await expect(caller.notifications.sendMarketing({ title: "이벤트" })).rejects.toThrow();
  });

  it("관리자는 수신 동의자에게만 발송한다", async () => {
    vi.spyOn(db, "getMarketingOptInUserIds").mockResolvedValue([2, 5]);
    const createForUsers = vi.spyOn(db, "createNotificationsForUsers").mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(createContext({ role: "admin" }));
    const result = await caller.notifications.sendMarketing({ title: "이벤트 안내", body: "내용" });

    expect(createForUsers).toHaveBeenCalledWith([2, 5], expect.objectContaining({ type: "marketing" }));
    expect(result.sentCount).toBe(2);
  });

  it("동의자가 없으면 아무에게도 발송하지 않는다", async () => {
    vi.spyOn(db, "getMarketingOptInUserIds").mockResolvedValue([]);
    const createForUsers = vi.spyOn(db, "createNotificationsForUsers").mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(createContext({ role: "admin" }));
    const result = await caller.notifications.sendMarketing({ title: "이벤트 안내" });

    expect(result.sentCount).toBe(0);
    expect(createForUsers).toHaveBeenCalledWith([], expect.anything());
  });
});
