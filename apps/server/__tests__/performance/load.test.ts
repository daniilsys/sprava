/**
 * Performance / load simulation tests.
 *
 * Simulates concurrent operations to verify:
 *   - Multiple users sending messages simultaneously
 *   - Concurrent server joins
 *   - Friendship operations under load
 *   - Service response times
 *
 * These tests use mocked DB/Redis so they measure framework overhead
 * and service logic throughput, not actual DB performance.
 * Run with: pnpm vitest run --testPathPattern=performance
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChannelsService } from "../../src/modules/channels/channels.service.js";
import { ServersService } from "../../src/modules/servers/servers.service.js";
import { FriendshipsService } from "../../src/modules/friendships/friendships.service.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { prisma } from "../../src/config/db.js";
import { makeChannel, makeMessage, makeServer, makeMember, makeUser } from "../helpers/factories.js";

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(async () => "$2b$12$hashed"),
    compare: vi.fn(async () => true),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "mock-jwt"),
    verify: vi.fn(() => ({ userId: "user-1" })),
  },
}));

describe("Performance: Concurrent Message Sending", () => {
  it("should handle 100 concurrent messages without errors", async () => {
    const service = new ChannelsService();
    const channel = makeChannel({ id: "ch1", serverId: "s1" });

    vi.mocked(prisma.channel.findUnique).mockResolvedValue({
      ...channel,
      server: {},
    } as any);

    let msgCount = 0;
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const tx = {
        message: {
          create: vi.fn().mockResolvedValue({
            ...makeMessage({ id: `msg-${++msgCount}`, channelId: "ch1" }),
            author: { id: "user-1", username: "test", avatar: null },
          }),
        },
        attachment: {},
      };
      return fn(tx);
    });

    const start = performance.now();

    // Fire 100 concurrent message sends
    const promises = Array.from({ length: 100 }, (_, i) =>
      service.sendMessage("ch1", { content: `Message ${i}` }, `user-${i % 10}`),
    );

    const results = await Promise.allSettled(promises);
    const elapsed = performance.now() - start;

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(100);

    console.log(`100 concurrent messages: ${elapsed.toFixed(1)}ms`);
    // With mocked DB, this should be fast — flag if it takes > 2s
    expect(elapsed).toBeLessThan(5000);
  });
});

describe("Performance: Concurrent Server Joins", () => {
  it("should handle 50 concurrent server joins", async () => {
    const service = new ServersService();

    vi.mocked(prisma.server.findUnique).mockResolvedValue(
      makeServer({ inviteCode: "test-code" }) as any,
    );
    vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(null); // not yet a member
    vi.mocked(prisma.serverMember.create).mockResolvedValue({} as any);
    vi.mocked(prisma.channel.findMany).mockResolvedValue([]);

    const start = performance.now();

    const promises = Array.from({ length: 50 }, (_, i) =>
      service.joinByInviteCode("test-code", `user-${i}`),
    );

    const results = await Promise.allSettled(promises);
    const elapsed = performance.now() - start;

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(50);

    console.log(`50 concurrent joins: ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(5000);
  });
});

describe("Performance: Concurrent Auth Operations", () => {
  it("should handle 50 concurrent login attempts", async () => {
    const service = new AuthService();

    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as any);
    vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);
    vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 0 });

    const start = performance.now();

    const promises = Array.from({ length: 50 }, () =>
      service.login({ email: "test@test.com", password: "password123" }),
    );

    const results = await Promise.allSettled(promises);
    const elapsed = performance.now() - start;

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(50);

    console.log(`50 concurrent logins: ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(5000);
  });
});

describe("Performance: Friendship Operations Under Load", () => {
  it("should handle 30 concurrent friend requests", async () => {
    const service = new FriendshipsService();

    let callCount = 0;
    vi.mocked(prisma.user.findUnique).mockImplementation(async () => {
      return makeUser({ id: `user-${++callCount}`, username: `user_${callCount}` }) as any;
    });
    vi.mocked(prisma.friendship.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.friendship.create).mockImplementation(async () => {
      return {
        id: `f-${callCount}`,
        senderId: "user-1",
        receiverId: `user-${callCount}`,
        status: "PENDING",
        createdAt: new Date(),
      } as any;
    });

    const start = performance.now();

    const promises = Array.from({ length: 30 }, (_, i) =>
      service.sendRequest(`user_${i + 100}`, "user-1"),
    );

    const results = await Promise.allSettled(promises);
    const elapsed = performance.now() - start;

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(30);

    console.log(`30 concurrent friend requests: ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(5000);
  });
});

describe("Performance: Message Retrieval", () => {
  it("should handle 50 concurrent getMessages calls", async () => {
    const service = new ChannelsService();

    vi.mocked(prisma.channel.findUnique).mockResolvedValue({
      ...makeChannel(),
      server: {},
    } as any);

    // Return 50 messages each time
    const messages = Array.from({ length: 50 }, (_, i) => ({
      ...makeMessage({ id: `m-${i}` }),
      author: { id: "u1", username: "test", avatar: null },
      reactions: [],
      attachments: [],
    }));
    vi.mocked(prisma.message.findMany).mockResolvedValue(messages as any);

    const start = performance.now();

    const promises = Array.from({ length: 50 }, () =>
      service.getMessages("ch1", "user-1"),
    );

    const results = await Promise.allSettled(promises);
    const elapsed = performance.now() - start;

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(50);

    // Verify each returned correct count
    for (const r of fulfilled) {
      if (r.status === "fulfilled") {
        expect(r.value).toHaveLength(50);
      }
    }

    console.log(`50 concurrent getMessages (50 msgs each): ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(5000);
  });
});
