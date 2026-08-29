import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    email: `user${userId}@example.com`,
    passwordHash: null,
    name: `2022${userId} 테스터`,
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

describe("users.search", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls searchUsers excluding the current user", async () => {
    const spy = vi
      .spyOn(db, "searchUsers")
      .mockResolvedValue([{ id: 2, name: "20222 학생", role: "user", status: "active" }] as never);
    const caller = appRouter.createCaller(createAuthContext(1));

    const result = await caller.users.search({ query: "학생" });

    expect(spy).toHaveBeenCalledWith("학생", 1, 20);
    expect(result).toHaveLength(1);
  });

  it("rejects empty query", async () => {
    const caller = appRouter.createCaller(createAuthContext(1));
    await expect(caller.users.search({ query: "" })).rejects.toThrow();
  });
});

describe("chat.startConversation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects starting a conversation with oneself", async () => {
    const caller = appRouter.createCaller(createAuthContext(1));
    await expect(
      caller.chat.startConversation({ targetUserId: 1 })
    ).rejects.toThrow();
  });

  it("rejects when target user does not exist", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue(null as never);
    const caller = appRouter.createCaller(createAuthContext(1));
    await expect(
      caller.chat.startConversation({ targetUserId: 999 })
    ).rejects.toThrow();
  });

  it("creates/returns a conversation for a valid target", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue({ id: 2, name: "상대" } as never);
    const convSpy = vi
      .spyOn(db, "getOrCreateConversation")
      .mockResolvedValue({ id: 10, userAId: 1, userBId: 2 } as never);
    const caller = appRouter.createCaller(createAuthContext(1));

    const result = await caller.chat.startConversation({ targetUserId: 2 });

    expect(convSpy).toHaveBeenCalledWith(1, 2);
    expect(result.id).toBe(10);
  });
});

describe("chat.sendMessage / getMessages access control", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("forbids sending to a conversation the user is not part of", async () => {
    vi.spyOn(db, "getConversationById").mockResolvedValue({
      id: 5,
      userAId: 2,
      userBId: 3,
    } as never);
    const caller = appRouter.createCaller(createAuthContext(1));

    await expect(
      caller.chat.sendMessage({ conversationId: 5, content: "hi" })
    ).rejects.toThrow();
  });

  it("allows sending to a conversation the user belongs to", async () => {
    vi.spyOn(db, "getConversationById").mockResolvedValue({
      id: 5,
      userAId: 1,
      userBId: 3,
    } as never);
    const sendSpy = vi
      .spyOn(db, "createMessage")
      .mockResolvedValue({ id: 100, conversationId: 5, senderId: 1, content: "hi" } as never);
    const caller = appRouter.createCaller(createAuthContext(1));

    await caller.chat.sendMessage({ conversationId: 5, content: "  hi  " });

    expect(sendSpy).toHaveBeenCalledWith(5, 1, "hi");
  });

  it("forbids reading messages from a foreign conversation", async () => {
    vi.spyOn(db, "getConversationById").mockResolvedValue({
      id: 7,
      userAId: 4,
      userBId: 5,
    } as never);
    const caller = appRouter.createCaller(createAuthContext(1));

    await expect(
      caller.chat.getMessages({ conversationId: 7 })
    ).rejects.toThrow();
  });
});
