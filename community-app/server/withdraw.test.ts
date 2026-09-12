import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as media from "./media";
import { WITHDRAW_CONFIRM_TEXT } from "@shared/const";
import { ENV } from "./_core/env";

ENV.cookieSecret = ENV.cookieSecret || "test-secret-for-withdraw-spec";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function ctxFor(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user = {
    id: 1,
    email: "a@b.com",
    passwordHash: null,
    name: "20223 홍길동",
    loginMethod: "email",
    role: "user",
    status: "active",
    avatarImageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  } as AuthenticatedUser;

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("회원 탈퇴", () => {
  it("확인 문구를 정확히 입력하면 탈퇴된다", async () => {
    const withdraw = vi.spyOn(db, "withdrawUser").mockResolvedValue({ avatarImageUrl: null });

    const caller = appRouter.createCaller(ctxFor({ id: 42 }));
    await expect(caller.auth.withdraw({ confirm: WITHDRAW_CONFIRM_TEXT })).resolves.toEqual({
      success: true,
    });
    expect(withdraw).toHaveBeenCalledWith(42);
  });

  it("확인 문구가 틀리면 거부된다 (오조작 방지)", async () => {
    const withdraw = vi.spyOn(db, "withdrawUser").mockResolvedValue({ avatarImageUrl: null });

    const caller = appRouter.createCaller(ctxFor());
    await expect(
      caller.auth.withdraw({ confirm: "탈퇴" } as never)
    ).rejects.toThrow();
    expect(withdraw).not.toHaveBeenCalled();
  });

  it("조물주는 탈퇴할 수 없다 (아무도 가입 승인을 못 하게 된다)", async () => {
    const withdraw = vi.spyOn(db, "withdrawUser").mockResolvedValue({ avatarImageUrl: null });

    const caller = appRouter.createCaller(ctxFor({ role: "owner" }));
    await expect(caller.auth.withdraw({ confirm: WITHDRAW_CONFIRM_TEXT })).rejects.toThrow(
      "조물주 계정은 탈퇴할 수 없습니다"
    );
    expect(withdraw).not.toHaveBeenCalled();
  });

  it("승인 대기 상태에서도 탈퇴할 수 있다", async () => {
    const withdraw = vi.spyOn(db, "withdrawUser").mockResolvedValue({ avatarImageUrl: null });

    const caller = appRouter.createCaller(ctxFor({ status: "pending" }));
    await expect(caller.auth.withdraw({ confirm: WITHDRAW_CONFIRM_TEXT })).resolves.toEqual({
      success: true,
    });
    expect(withdraw).toHaveBeenCalled();
  });

  it("탈퇴하면 프로필 사진 파일도 저장소에서 지운다", async () => {
    vi.spyOn(db, "withdrawUser").mockResolvedValue({
      avatarImageUrl: "https://cdn.example.com/avatars/abc/1.png",
    });
    const del = vi.spyOn(media, "deleteUploadByUrl").mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctxFor());
    await caller.auth.withdraw({ confirm: WITHDRAW_CONFIRM_TEXT });

    expect(del).toHaveBeenCalledWith("https://cdn.example.com/avatars/abc/1.png");
  });

  it("기본값은 글을 남긴다 (대화 맥락 보존)", async () => {
    vi.spyOn(db, "withdrawUser").mockResolvedValue({ avatarImageUrl: null });
    const softDelete = vi.spyOn(db, "softDeleteUserContent").mockResolvedValue({ imageUrls: [] });

    const caller = appRouter.createCaller(ctxFor());
    await caller.auth.withdraw({ confirm: WITHDRAW_CONFIRM_TEXT });

    expect(softDelete).not.toHaveBeenCalled();
  });

  it("선택하면 내가 쓴 글·댓글도 함께 지우고 첨부 이미지를 정리한다", async () => {
    vi.spyOn(db, "withdrawUser").mockResolvedValue({ avatarImageUrl: null });
    const softDelete = vi
      .spyOn(db, "softDeleteUserContent")
      .mockResolvedValue({ imageUrls: ["https://x/uploads/posts/a/1.png"] });
    const delMany = vi.spyOn(media, "deleteUploadsByUrl").mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctxFor({ id: 42 }));
    await caller.auth.withdraw({ confirm: WITHDRAW_CONFIRM_TEXT, deleteContent: true });

    expect(softDelete).toHaveBeenCalledWith(42);
    expect(delMany).toHaveBeenCalledWith(["https://x/uploads/posts/a/1.png"]);
  });

  it("비로그인은 탈퇴를 호출할 수 없다", async () => {
    const anon: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { cookie: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(anon);
    await expect(caller.auth.withdraw({ confirm: WITHDRAW_CONFIRM_TEXT })).rejects.toThrow();
  });
});

describe("업로드 경로는 작성자를 드러내지 않는다", () => {
  it("같은 사용자는 항상 같은 값, 다른 사용자는 다른 값이 나온다", () => {
    expect(media.uploadScopeId(7)).toBe(media.uploadScopeId(7));
    expect(media.uploadScopeId(7)).not.toBe(media.uploadScopeId(8));
  });

  it("결과에 회원번호가 그대로 드러나지 않는다", () => {
    // "posts/123/..." 처럼 id가 경로에 박히면 익명 글의 이미지 주소만으로 작성자를 알 수 있다.
    const scope = media.uploadScopeId(123);
    expect(scope).not.toContain("123");
    expect(scope).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("auth.me는 비밀번호 해시를 내보내지 않는다", () => {
  it("passwordHash 대신 hasPassword 불리언만 준다", async () => {
    const caller = appRouter.createCaller(ctxFor({ passwordHash: "$2a$12$fakehash" }));
    const me = (await caller.auth.me()) as unknown as Record<string, unknown>;

    expect(me).not.toHaveProperty("passwordHash");
    expect(me.hasPassword).toBe(true);
  });

  it("소셜 전용 계정은 hasPassword가 false", async () => {
    const caller = appRouter.createCaller(ctxFor({ passwordHash: null }));
    const me = (await caller.auth.me()) as unknown as Record<string, unknown>;

    expect(me.hasPassword).toBe(false);
  });
});
