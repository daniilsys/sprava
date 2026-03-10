/**
 * Unit tests for WebSocket event handlers.
 * Simulates socket connections and verifies event delivery for
 * typing indicators, read state, presence, and disconnect cleanup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../../../src/config/db.js";
import { redis } from "../../../src/config/redis.js";
import { makeMember, makeServer } from "../../helpers/factories.js";

// Build a mock Socket that captures .on() handlers
function createMockSocket(userId: string) {
  const handlers = new Map<string, Function>();
  const socket = {
    id: "socket-1",
    data: { userId },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: vi.fn() })),
    on: vi.fn((event: string, handler: Function) => {
      handlers.set(event, handler);
    }),
    rooms: new Set<string>(),
    _handlers: handlers,
  };
  return socket;
}

function createMockIO() {
  const chainable = {
    emit: vi.fn(),
    socketsJoin: vi.fn(),
    socketsLeave: vi.fn(),
    fetchSockets: vi.fn(async () => []),
  };
  return {
    to: vi.fn(() => chainable),
    in: vi.fn(() => chainable),
    emit: vi.fn(),
    _chainable: chainable,
  };
}

describe("Socket Handlers", () => {
  let io: ReturnType<typeof createMockIO>;
  let socket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    io = createMockIO();
    socket = createMockSocket("user-1");

    // Default DB mocks for joinUserRooms + emitReady
    vi.mocked(prisma.serverMember.findMany).mockResolvedValue([
      makeMember({ serverId: "s1" }),
    ] as any);
    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      { id: "ch1" },
    ] as any);
    vi.mocked(prisma.dmParticipant.findMany).mockResolvedValue([
      { dmConversationId: "dm1" },
    ] as any);

    // Ready cache misses — force DB fetch
    vi.mocked(redis.get).mockResolvedValue(null);

    // Mock redis.smembers for presence subscriptions
    vi.mocked(redis.smembers).mockResolvedValue([]);

    // DB responses for emitReady
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      username: "test",
      avatar: null,
      profile: null,
      settings: null,
    } as any);
    vi.mocked(prisma.server.findMany).mockResolvedValue([]);
    vi.mocked(prisma.friendship.findMany).mockResolvedValue([]);
    vi.mocked(prisma.dmConversation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.readState.findMany).mockResolvedValue([]);
    vi.mocked(prisma.memberRole.findMany).mockResolvedValue([]);
    vi.mocked(prisma.channelRule.findMany).mockResolvedValue([]);
  });

  // ── Connection + room joining ─────────────────────────────────────────────

  describe("connection setup", () => {
    it("should register all socket event handlers", async () => {
      const { registerSocketHandlers } = await import(
        "../../../src/websocket/socket.handlers.js"
      );
      await registerSocketHandlers(io as any, socket as any);

      // Should have registered core handlers
      expect(socket.on).toHaveBeenCalledWith("typing:start", expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith("typing:stop", expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith("channel:read", expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith("dm:read", expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
      // New handlers
      expect(socket.on).toHaveBeenCalledWith("presence:subscribe", expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith("presence:unsubscribe", expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith("channel:focus", expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith("server:request_members", expect.any(Function));
    });

    it("should join user to correct rooms (P2: no channel rooms)", async () => {
      const { registerSocketHandlers } = await import(
        "../../../src/websocket/socket.handlers.js"
      );
      await registerSocketHandlers(io as any, socket as any);

      expect(socket.join).toHaveBeenCalledWith("user:user-1");
      expect(socket.join).toHaveBeenCalledWith("server:s1");
      // P2: channel rooms are NOT joined on connect (joined via channel:focus)
      expect(socket.join).not.toHaveBeenCalledWith("channel:ch1");
      expect(socket.join).toHaveBeenCalledWith("dm:dm1");
    });

    it("should emit ready event with initial state", async () => {
      const { registerSocketHandlers } = await import(
        "../../../src/websocket/socket.handlers.js"
      );
      await registerSocketHandlers(io as any, socket as any);

      expect(socket.emit).toHaveBeenCalledWith("ready", expect.objectContaining({
        user: expect.anything(),
        servers: expect.any(Array),
        friendships: expect.any(Array),
        dms: expect.any(Array),
        readStates: expect.any(Array),
        voiceStates: expect.any(Array),
      }));
    });

    it("should broadcast presence to subscribers on connect", async () => {
      // Simulate someone is subscribed to this user's presence
      vi.mocked(redis.smembers).mockResolvedValue(["user-2"]);

      const { registerSocketHandlers } = await import(
        "../../../src/websocket/socket.handlers.js"
      );
      await registerSocketHandlers(io as any, socket as any);

      // Should broadcast to subscribers via io.to(["user:user-2"])
      expect(io.to).toHaveBeenCalledWith(["user:user-2"]);
    });
  });

  // ── Typing indicators ────────────────────────────────────────────────────

  describe("typing indicators", () => {
    it("should emit channel:typing on typing:start", async () => {
      const { registerSocketHandlers } = await import(
        "../../../src/websocket/socket.handlers.js"
      );
      await registerSocketHandlers(io as any, socket as any);

      const handler = socket._handlers.get("typing:start");
      expect(handler).toBeTruthy();

      handler!({ channelId: "ch1" });

      expect(socket.to).toHaveBeenCalledWith("channel:ch1");
    });

    it("should emit dm:typing for DM typing", async () => {
      const { registerSocketHandlers } = await import(
        "../../../src/websocket/socket.handlers.js"
      );
      await registerSocketHandlers(io as any, socket as any);

      const handler = socket._handlers.get("typing:start");
      handler!({ dmConversationId: "dm1" });

      expect(socket.to).toHaveBeenCalledWith("dm:dm1");
    });

    it("should auto-stop typing after 5 seconds", async () => {
      vi.useFakeTimers();

      const { registerSocketHandlers } = await import(
        "../../../src/websocket/socket.handlers.js"
      );
      await registerSocketHandlers(io as any, socket as any);

      const handler = socket._handlers.get("typing:start");
      handler!({ channelId: "ch1" });

      // Advance past 5s auto-stop
      vi.advanceTimersByTime(5000);

      // Should have emitted typing: false
      const toCalls = socket.to.mock.results;
      const lastResult = toCalls[toCalls.length - 1];
      expect(lastResult.value.emit).toHaveBeenCalledWith(
        "channel:typing",
        expect.objectContaining({ typing: false }),
      );

      vi.useRealTimers();
    });
  });

  // ── Read state ────────────────────────────────────────────────────────────

  describe("read state", () => {
    it("should upsert channel read state", async () => {
      vi.mocked(prisma.readState.upsert).mockResolvedValue({} as any);

      const { registerSocketHandlers } = await import(
        "../../../src/websocket/socket.handlers.js"
      );
      await registerSocketHandlers(io as any, socket as any);

      const handler = socket._handlers.get("channel:read");
      await handler!({ channelId: "ch1", lastReadMessageId: "msg-5" });

      expect(prisma.readState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_channelId: { userId: "user-1", channelId: "ch1" } },
        }),
      );
    });

    it("should upsert DM read state", async () => {
      vi.mocked(prisma.readState.upsert).mockResolvedValue({} as any);

      const { registerSocketHandlers } = await import(
        "../../../src/websocket/socket.handlers.js"
      );
      await registerSocketHandlers(io as any, socket as any);

      const handler = socket._handlers.get("dm:read");
      await handler!({ dmConversationId: "dm1", lastReadMessageId: "msg-3" });

      expect(prisma.readState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_dmConversationId: {
              userId: "user-1",
              dmConversationId: "dm1",
            },
          },
        }),
      );
    });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────

  describe("disconnect", () => {
    it("should broadcast offline presence to subscribers when no other sockets remain", async () => {
      // Subscribe user-2 to user-1's presence
      vi.mocked(redis.smembers).mockResolvedValue(["user-2"]);

      const { registerSocketHandlers } = await import(
        "../../../src/websocket/socket.handlers.js"
      );
      await registerSocketHandlers(io as any, socket as any);

      // Simulate no remaining sockets
      io._chainable.fetchSockets.mockResolvedValue([]);

      const disconnectHandler = socket._handlers.get("disconnect");
      await disconnectHandler!();

      // Should broadcast offline to subscribers
      expect(io.to).toHaveBeenCalledWith(["user:user-2"]);
    });

    it("should NOT broadcast offline if other sockets remain", async () => {
      const { registerSocketHandlers } = await import(
        "../../../src/websocket/socket.handlers.js"
      );
      await registerSocketHandlers(io as any, socket as any);

      // Clear previous calls
      io.to.mockClear();
      vi.mocked(redis.smembers).mockResolvedValue([]);

      // Simulate another active socket
      io._chainable.fetchSockets.mockResolvedValue([{ id: "other-socket" }]);

      const disconnectHandler = socket._handlers.get("disconnect");
      await disconnectHandler!();

      // Should not have broadcast offline presence
      const offlineCalls = io.to.mock.calls;
      // No io.to calls for presence broadcast since user has remaining sockets
      expect(offlineCalls.length).toBe(0);
    });
  });
});
