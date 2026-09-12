import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { resetRateLimits } from "./_core/rateLimit";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function ctxFor(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      email: "admin@school.kr",
      passwordHash: null,
      name: "20223 관리자",
      loginMethod: "email",
      role: "admin",
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

function reportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    reporterUserId: 5,
    targetType: "post",
    targetId: 77,
    reason: "욕설",
    description: null,
    status: "pending",
    adminNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as never;
}

function targetUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    role: "user",
    status: "active",
    name: "20223 작성자",
    ...overrides,
  } as never;
}

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
});

describe("신고 처리 — 게시물 삭제", () => {
  it("게시글 신고를 삭제하면 글이 지워지고 해결로 바뀐다", async () => {
    vi.spyOn(db, "getReportById").mockResolvedValue(reportRow());
    const deletePost = vi.spyOn(db, "deletePost").mockResolvedValue({} as never);
    const updateStatus = vi.spyOn(db, "updateReportStatus").mockResolvedValue({} as never);

    const caller = appRouter.createCaller(ctxFor());
    await expect(caller.reports.act({ id: 10, action: "delete_content" })).resolves.toEqual({
      success: true,
      status: "resolved",
    });

    expect(deletePost).toHaveBeenCalledWith(77);
    expect(updateStatus).toHaveBeenCalledWith(10, "resolved");
  });

  it("댓글 신고는 게시글이 아니라 댓글을 지운다", async () => {
    vi.spyOn(db, "getReportById").mockResolvedValue(reportRow({ targetType: "comment", targetId: 42 }));
    const deletePost = vi.spyOn(db, "deletePost").mockResolvedValue({} as never);
    const deleteComment = vi.spyOn(db, "deleteComment").mockResolvedValue({} as never);
    vi.spyOn(db, "updateReportStatus").mockResolvedValue({} as never);

    const caller = appRouter.createCaller(ctxFor());
    await caller.reports.act({ id: 10, action: "delete_content" });

    expect(deleteComment).toHaveBeenCalledWith(42);
    expect(deletePost).not.toHaveBeenCalled();
  });

  it("'문제 없음'은 아무것도 지우지 않고 무시로 바꾼다", async () => {
    vi.spyOn(db, "getReportById").mockResolvedValue(reportRow());
    const deletePost = vi.spyOn(db, "deletePost").mockResolvedValue({} as never);
    const updateStatus = vi.spyOn(db, "updateReportStatus").mockResolvedValue({} as never);

    const caller = appRouter.createCaller(ctxFor());
    await expect(caller.reports.act({ id: 10, action: "dismiss" })).resolves.toEqual({
      success: true,
      status: "dismissed",
    });

    expect(deletePost).not.toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalledWith(10, "dismissed");
  });

  it("없는 신고는 거부한다", async () => {
    vi.spyOn(db, "getReportById").mockResolvedValue(null);
    const caller = appRouter.createCaller(ctxFor());
    await expect(caller.reports.act({ id: 999, action: "delete_content" })).rejects.toThrow(
      "신고를 찾을 수 없습니다"
    );
  });

  it("일반 사용자는 신고를 처리할 수 없다", async () => {
    const caller = appRouter.createCaller(ctxFor({ role: "user" }));
    await expect(caller.reports.act({ id: 10, action: "delete_content" })).rejects.toThrow();
  });
});

describe("신고 처리 — 작성자 차단", () => {
  it("작성자를 차단하고 신고를 해결로 바꾼다", async () => {
    vi.spyOn(db, "getReportById").mockResolvedValue(reportRow());
    vi.spyOn(db, "getReportTargetAuthorId").mockResolvedValue(9);
    vi.spyOn(db, "getUserById").mockResolvedValue(targetUser());
    const block = vi.spyOn(db, "updateUserStatus").mockResolvedValue({} as never);
    vi.spyOn(db, "updateReportStatus").mockResolvedValue({} as never);

    const caller = appRouter.createCaller(ctxFor());
    await caller.reports.act({ id: 10, action: "block_author" });

    expect(block).toHaveBeenCalledWith(9, "blocked");
  });

  it("익명 글이어도 차단은 된다 (신원을 모른 채 조치할 수 있어야 한다)", async () => {
    vi.spyOn(db, "getReportById").mockResolvedValue(reportRow());
    // 익명이라 목록에는 작성자가 안 나오지만, 서버는 내부적으로 알고 있다
    const authorId = vi.spyOn(db, "getReportTargetAuthorId").mockResolvedValue(9);
    vi.spyOn(db, "getUserById").mockResolvedValue(targetUser());
    const block = vi.spyOn(db, "updateUserStatus").mockResolvedValue({} as never);
    vi.spyOn(db, "updateReportStatus").mockResolvedValue({} as never);

    const caller = appRouter.createCaller(ctxFor());
    await caller.reports.act({ id: 10, action: "block_author" });

    expect(authorId).toHaveBeenCalledWith("post", 77);
    expect(block).toHaveBeenCalledWith(9, "blocked");
  });

  it("조물주는 차단할 수 없다", async () => {
    vi.spyOn(db, "getReportById").mockResolvedValue(reportRow());
    vi.spyOn(db, "getReportTargetAuthorId").mockResolvedValue(9);
    vi.spyOn(db, "getUserById").mockResolvedValue(targetUser({ role: "owner" }));
    const block = vi.spyOn(db, "updateUserStatus").mockResolvedValue({} as never);

    const caller = appRouter.createCaller(ctxFor());
    await expect(caller.reports.act({ id: 10, action: "block_author" })).rejects.toThrow(
      "조물주는 차단할 수 없습니다"
    );
    expect(block).not.toHaveBeenCalled();
  });

  it("다른 관리자는 조물주만 차단할 수 있다", async () => {
    vi.spyOn(db, "getReportById").mockResolvedValue(reportRow());
    vi.spyOn(db, "getReportTargetAuthorId").mockResolvedValue(9);
    vi.spyOn(db, "getUserById").mockResolvedValue(targetUser({ role: "admin" }));
    const block = vi.spyOn(db, "updateUserStatus").mockResolvedValue({} as never);
    vi.spyOn(db, "updateReportStatus").mockResolvedValue({} as never);

    await expect(
      appRouter.createCaller(ctxFor({ role: "admin" })).reports.act({ id: 10, action: "block_author" })
    ).rejects.toThrow("조물주만 차단할 수 있습니다");
    expect(block).not.toHaveBeenCalled();

    await appRouter.createCaller(ctxFor({ role: "owner" })).reports.act({ id: 10, action: "block_author" });
    expect(block).toHaveBeenCalledWith(9, "blocked");
  });

  it("자기 자신은 차단할 수 없다 (실수로 로그아웃되는 걸 막는다)", async () => {
    vi.spyOn(db, "getReportById").mockResolvedValue(reportRow());
    vi.spyOn(db, "getReportTargetAuthorId").mockResolvedValue(1);
    vi.spyOn(db, "getUserById").mockResolvedValue(targetUser({ id: 1 }));
    const block = vi.spyOn(db, "updateUserStatus").mockResolvedValue({} as never);

    const caller = appRouter.createCaller(ctxFor({ id: 1 }));
    await expect(caller.reports.act({ id: 10, action: "block_author" })).rejects.toThrow(
      "자기 자신은 차단할 수 없습니다"
    );
    expect(block).not.toHaveBeenCalled();
  });

  it("작성자 계정이 이미 없으면 안내한다", async () => {
    vi.spyOn(db, "getReportById").mockResolvedValue(reportRow());
    vi.spyOn(db, "getReportTargetAuthorId").mockResolvedValue(null);

    const caller = appRouter.createCaller(ctxFor());
    await expect(caller.reports.act({ id: 10, action: "block_author" })).rejects.toThrow(
      "작성자를 찾을 수 없습니다"
    );
  });
});

describe("첨부 이미지 정규화", () => {
  // MariaDB는 json 컬럼을 "[]" 같은 문자열로 내려준다. 정규화를 빠뜨리면
  // 관리자 신고 화면이 images.map에서 통째로 크래시한다 (실제로 한 번 겪었다).
  it("문자열로 온 JSON을 배열로 되돌린다", () => {
    expect(db.normalizePostImages({ images: '["https://x/a.png"]' }).images).toEqual([
      "https://x/a.png",
    ]);
  });

  it("빈 배열 문자열도 배열이 된다", () => {
    expect(db.normalizePostImages({ images: "[]" }).images).toEqual([]);
  });

  it("이미 배열이면 그대로 둔다", () => {
    const images = ["https://x/a.png"];
    expect(db.normalizePostImages({ images }).images).toBe(images);
  });

  it("null이나 깨진 값은 빈 배열로 만든다 (화면이 죽지 않아야 한다)", () => {
    expect(db.normalizePostImages({ images: null }).images).toEqual([]);
    expect(db.normalizePostImages({ images: undefined }).images).toEqual([]);
    expect(db.normalizePostImages({ images: "{망가진" }).images).toEqual([]);
  });
});
