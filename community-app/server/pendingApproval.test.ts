import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { NOT_APPROVED_ERR_MSG } from "@shared/const";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function userWith(status: "active" | "pending", overrides: Partial<AuthenticatedUser> = {}) {
  return {
    id: 1,
    email: "student@example.com",
    passwordHash: null,
    name: "20223 홍길동",
    loginMethod: "email",
    role: "user",
    status,
    approvalNote: null,
    notifyPost: false,
    notifyMarketing: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  } as AuthenticatedUser;
}

function createContext(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const pendingCaller = () => appRouter.createCaller(createContext(userWith("pending")));
const activeCaller = () => appRouter.createCaller(createContext(userWith("active")));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("승인 대기(pending) 사용자 — 활동 차단", () => {
  it("게시글을 쓸 수 없다", async () => {
    const createPost = vi.spyOn(db, "createPost").mockResolvedValue({ id: 1 } as never);

    await expect(
      pendingCaller().posts.create({ boardId: 1, title: "제목", content: "본문", isAnonymous: false })
    ).rejects.toThrow(NOT_APPROVED_ERR_MSG);

    // 미들웨어에서 막혔으므로 DB까지 내려가지 않아야 한다.
    expect(createPost).not.toHaveBeenCalled();
  });

  it("댓글을 쓸 수 없다", async () => {
    const createComment = vi.spyOn(db, "createComment").mockResolvedValue({ id: 1 } as never);

    await expect(
      pendingCaller().comments.create({ postId: 1, content: "댓글", isAnonymous: false })
    ).rejects.toThrow(NOT_APPROVED_ERR_MSG);

    expect(createComment).not.toHaveBeenCalled();
  });

  it("추천(좋아요)을 누를 수 없다", async () => {
    const addLike = vi.spyOn(db, "addPostLike").mockResolvedValue(undefined as never);

    await expect(pendingCaller().likes.togglePostLike({ postId: 1 })).rejects.toThrow(
      NOT_APPROVED_ERR_MSG
    );

    expect(addLike).not.toHaveBeenCalled();
  });

  it("쪽지를 보낼 수 없다", async () => {
    const createMessage = vi.spyOn(db, "createMessage").mockResolvedValue({ id: 1 } as never);

    await expect(
      pendingCaller().chat.sendMessage({ conversationId: 1, content: "안녕" })
    ).rejects.toThrow(NOT_APPROVED_ERR_MSG);

    expect(createMessage).not.toHaveBeenCalled();
  });

  it("쪽지 대화를 새로 열 수 없다", async () => {
    const getOrCreate = vi.spyOn(db, "getOrCreateConversation").mockResolvedValue({ id: 1 } as never);

    await expect(pendingCaller().chat.startConversation({ otherUserId: 2 })).rejects.toThrow(
      NOT_APPROVED_ERR_MSG
    );

    expect(getOrCreate).not.toHaveBeenCalled();
  });

  it("다른 학생을 검색할 수 없다 (승인 전에는 명단이 보이면 안 된다)", async () => {
    const searchUsers = vi.spyOn(db, "searchUsers").mockResolvedValue([] as never);

    await expect(pendingCaller().users.search({ query: "홍" })).rejects.toThrow(NOT_APPROVED_ERR_MSG);

    expect(searchUsers).not.toHaveBeenCalled();
  });

  it("신고를 올릴 수 없다", async () => {
    const createReport = vi.spyOn(db, "createReport").mockResolvedValue({ id: 1 } as never);

    await expect(
      pendingCaller().reports.create({ targetType: "post", targetId: 1, reason: "스팸" })
    ).rejects.toThrow(NOT_APPROVED_ERR_MSG);

    expect(createReport).not.toHaveBeenCalled();
  });

  it("이미지를 업로드할 수 없다 (글쓰기 우회 경로 차단)", async () => {
    await expect(
      pendingCaller().media.uploadPostImage({ dataUrl: "data:image/png;base64,AAAA" })
    ).rejects.toThrow(NOT_APPROVED_ERR_MSG);
  });
});

describe("승인 대기 사용자 — 허용되어야 하는 것", () => {
  it("알림을 읽을 수 있다 (승인 알림을 받아야 하므로)", async () => {
    vi.spyOn(db, "getNotifications").mockResolvedValue([] as never);

    await expect(pendingCaller().notifications.list({})).resolves.toEqual([]);
  });

  it("문의를 보낼 수 있다 (승인 대기자의 유일한 관리자 연락 수단)", async () => {
    const createInquiry = vi.spyOn(db, "createInquiry").mockResolvedValue({ id: 1 } as never);

    await pendingCaller().inquiries.create({
      category: "account",
      title: "승인 문의",
      content: "언제 승인되나요?",
    });

    expect(createInquiry).toHaveBeenCalled();
  });

  it("자기 이름을 고칠 수 있다 (관리자가 학번·이름을 보고 승인하므로 오타를 고칠 수 있어야 한다)", async () => {
    const updateName = vi.spyOn(db, "updateUserName").mockResolvedValue(undefined as never);

    await pendingCaller().auth.updateName({ name: "20223 홍길동" });

    expect(updateName).toHaveBeenCalled();
  });
});

describe("승인된(active) 사용자는 그대로 활동할 수 있다", () => {
  it("게시글을 쓸 수 있다", async () => {
    const createPost = vi.spyOn(db, "createPost").mockResolvedValue({ id: 7 } as never);
    vi.spyOn(db, "getPostById").mockResolvedValue({ id: 7, userId: 1 } as never);

    await activeCaller().posts.create({
      boardId: 1,
      title: "제목",
      content: "본문",
      isAnonymous: false,
    });

    expect(createPost).toHaveBeenCalled();
  });

  it("추천을 누를 수 있다", async () => {
    vi.spyOn(db, "hasUserLikedPost").mockResolvedValue(false as never);
    const addLike = vi.spyOn(db, "addPostLike").mockResolvedValue(undefined as never);
    vi.spyOn(db, "getPostById").mockResolvedValue({ id: 1, userId: 2, title: "글" } as never);

    await activeCaller().likes.togglePostLike({ postId: 1 });

    expect(addLike).toHaveBeenCalled();
  });
});

describe("비로그인 사용자", () => {
  it("승인 미들웨어가 아니라 로그인 요구로 먼저 막힌다", async () => {
    const anon = appRouter.createCaller(createContext(null));

    await expect(
      anon.posts.create({ boardId: 1, title: "제목", content: "본문", isAnonymous: false })
    ).rejects.toThrow();
  });
});
