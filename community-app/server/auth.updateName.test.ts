import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    email: "sample@example.com",
    passwordHash: null,
    name: "20223 조은후",
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

describe("auth.updateName", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid '학번 이름' formatted name", async () => {
    const spy = vi
      .spyOn(db, "updateUserName")
      .mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createAuthContext());

    await caller.auth.updateName({ name: "20223 조은후" });

    expect(spy).toHaveBeenCalledWith(1, "20223 조은후");
  });

  it("rejects a name missing the 5-digit student id", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.auth.updateName({ name: "조은후" })).rejects.toThrow();
  });

  it("rejects a name with a non 5-digit number", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    await expect(
      caller.auth.updateName({ name: "123 조은후" })
    ).rejects.toThrow();
  });

  it("rejects a name without a space-separated name part", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.auth.updateName({ name: "20223" })).rejects.toThrow();
  });
});

describe("auth.updatePassword", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a new password of sufficient length without current password", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 1,
      email: "sample@example.com",
      passwordHash: null,
      name: "20223 조은후",
      loginMethod: "email",
      role: "user",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as never);
    const spy = vi
      .spyOn(db, "updateUserPasswordHash")
      .mockResolvedValue(undefined as never);
    const caller = appRouter.createCaller(createAuthContext());

    await caller.auth.updatePassword({ newPassword: "newpass123" });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe(1);
    // 저장되는 값은 원문이 아니라 bcrypt 해시여야 한다.
    expect(spy.mock.calls[0]?.[1]).not.toBe("newpass123");
  });

  it("rejects a too-short new password", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    await expect(
      caller.auth.updatePassword({ newPassword: "ab" })
    ).rejects.toThrow();
  });
});
