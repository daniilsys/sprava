/**
 * Unit tests for voice WebSocket handlers.
 * Tests voice:join, voice:leave, voice:connect_transport,
 * voice:produce, voice:consume_request, and DM call notifications.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { redis } from "../../../src/config/redis.js";
import { prisma } from "../../../src/config/db.js";
import { rpcToSfu } from "../../../src/websocket/voice.redis.js";

function createMockSocket(userId: string) {
  const handlers = new Map<string, Function>();
  return {
    data: { userId },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: vi.fn() })),
    on: vi.fn((event: string, handler: Function) => {
      handlers.set(event, handler);
    }),
    _handlers: handlers,
  };
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

describe("Voice Handlers", () => {
  let io: ReturnType<typeof createMockIO>;
  let socket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    io = createMockIO();
    socket = createMockSocket("user-1");
  });

  async function registerVoice() {
    const { registerVoiceHandlers } = await import(
      "../../../src/websocket/voice.handlers.js"
    );
    registerVoiceHandlers(io as any, socket as any);
  }

  // ── voice:join (channel) ──────────────────────────────────────────────────

  describe("voice:join", () => {
    it("should join a voice channel and emit voice:joined", async () => {
      await registerVoice();

      // Mock channel lookup
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        id: "ch1",
        serverId: "s1",
        type: "VOICE",
      } as any);

      // No current voice state
      vi.mocked(redis.get).mockResolvedValue(null);

      // SFU responds with transport params
      vi.mocked(rpcToSfu).mockResolvedValue({
        transportParams: { id: "t1" },
        routerRtpCapabilities: { codecs: [] },
        existingProducers: [],
      });

      // Redis room members
      vi.mocked(redis.smembers).mockResolvedValue(["user-1"]);
      vi.mocked(redis.scard).mockResolvedValue(1);

      const handler = socket._handlers.get("voice:join");
      await handler!({ channelId: "ch1" });

      // Should emit voice:joined to the joining user
      expect(socket.emit).toHaveBeenCalledWith(
        "voice:joined",
        expect.objectContaining({
          transportParams: expect.anything(),
          routerRtpCapabilities: expect.anything(),
          voiceStates: expect.any(Array),
        }),
      );

      // Should join the voice room
      expect(socket.join).toHaveBeenCalledWith("voice:channel:ch1");

      // Should notify others in the room
      expect(socket.to).toHaveBeenCalledWith("voice:channel:ch1");
    });

    it("should reject non-VOICE channel", async () => {
      await registerVoice();

      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        id: "ch1",
        serverId: "s1",
        type: "TEXT",
      } as any);

      const handler = socket._handlers.get("voice:join");
      await handler!({ channelId: "ch1" });

      expect(socket.emit).toHaveBeenCalledWith("voice:error", {
        code: "INVALID_CHANNEL",
        message: "Not a voice channel",
      });
    });

    it("should auto-leave previous room before joining new one", async () => {
      await registerVoice();

      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        id: "ch2",
        serverId: "s1",
        type: "VOICE",
      } as any);

      // User is already in another room
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ roomId: "channel:ch1", joinedAt: new Date().toISOString() }),
      );

      vi.mocked(redis.smembers).mockResolvedValue(["user-1"]);
      vi.mocked(redis.scard).mockResolvedValue(1);

      const handler = socket._handlers.get("voice:join");
      await handler!({ channelId: "ch2" });

      // Should have left the old room (rpcToSfu LEAVE)
      expect(rpcToSfu).toHaveBeenCalledWith("LEAVE", "channel:ch1", "user-1");
    });

    it("should emit voice:error on missing payload", async () => {
      await registerVoice();

      const handler = socket._handlers.get("voice:join");
      await handler!({});

      expect(socket.emit).toHaveBeenCalledWith("voice:error", {
        code: "INVALID_PAYLOAD",
        message: "Missing channelId or dmConversationId",
      });
    });
  });

  // ── voice:join (DM) ───────────────────────────────────────────────────────

  describe("voice:join (DM call)", () => {
    it("should trigger dm_call_incoming for first joiner", async () => {
      await registerVoice();

      vi.mocked(prisma.dmParticipant.findUnique).mockResolvedValue({
        userId: "user-1",
        dmConversationId: "dm1",
      } as any);

      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(redis.scard).mockResolvedValue(1); // first joiner
      vi.mocked(redis.smembers).mockResolvedValue(["user-1"]);

      // Mock fetchSockets: first call returns caller sockets, second returns DM room sockets
      const otherSocket = { id: "other-socket", emit: vi.fn() };
      io._chainable.fetchSockets
        .mockResolvedValueOnce([{ id: "caller-socket" }]) // caller's sockets
        .mockResolvedValueOnce([
          { id: "caller-socket", emit: socket.emit }, // caller (excluded)
          otherSocket, // other DM participant
        ]);

      const handler = socket._handlers.get("voice:join");
      await handler!({ dmConversationId: "dm1" });

      // Should emit dm_call_incoming to other DM participants (not the caller)
      expect(otherSocket.emit).toHaveBeenCalledWith("voice:dm_call_incoming", {
        dmConversationId: "dm1",
        callerId: "user-1",
      });
    });

    it("should reject if user is not a DM participant", async () => {
      await registerVoice();

      vi.mocked(prisma.dmParticipant.findUnique).mockResolvedValue(null);

      const handler = socket._handlers.get("voice:join");
      await handler!({ dmConversationId: "dm1" });

      expect(socket.emit).toHaveBeenCalledWith("voice:error", {
        code: "NOT_PARTICIPANT",
        message: "Not in this DM",
      });
    });
  });

  // ── voice:leave ───────────────────────────────────────────────────────────

  describe("voice:leave", () => {
    it("should leave current voice room", async () => {
      await registerVoice();

      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ roomId: "channel:ch1", joinedAt: new Date().toISOString() }),
      );
      vi.mocked(redis.scard).mockResolvedValue(0); // room becomes empty

      const handler = socket._handlers.get("voice:leave");
      await handler!();

      expect(socket.emit).toHaveBeenCalledWith("voice:left");
      expect(socket.leave).toHaveBeenCalledWith("voice:channel:ch1");
    });

    it("should silently no-op if not in voice", async () => {
      await registerVoice();

      vi.mocked(redis.get).mockResolvedValue(null);

      const handler = socket._handlers.get("voice:leave");
      await handler!();

      // Should not emit voice:left (user wasn't in voice)
      expect(socket.emit).not.toHaveBeenCalledWith("voice:left");
    });

    it("should emit dm_call_ended when DM room becomes empty", async () => {
      await registerVoice();

      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ roomId: "dm:dm1", joinedAt: new Date().toISOString() }),
      );
      vi.mocked(redis.scard).mockResolvedValue(0); // empty after leave

      const handler = socket._handlers.get("voice:leave");
      await handler!();

      expect(io.to).toHaveBeenCalledWith("dm:dm1");
    });
  });

  // ── voice:connect_transport ───────────────────────────────────────────────

  describe("voice:connect_transport", () => {
    it("should forward DTLS params to SFU", async () => {
      await registerVoice();

      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ roomId: "channel:ch1" }),
      );
      vi.mocked(rpcToSfu).mockResolvedValue({});

      const handler = socket._handlers.get("voice:connect_transport");
      await handler!({ transportId: "t1", dtlsParameters: {} });

      expect(rpcToSfu).toHaveBeenCalledWith(
        "CONNECT_TRANSPORT",
        "channel:ch1",
        "user-1",
        { transportId: "t1", dtlsParameters: {} },
      );
      expect(socket.emit).toHaveBeenCalledWith("voice:transport_ok");
    });

    it("should emit voice:error if not in voice room", async () => {
      await registerVoice();

      vi.mocked(redis.get).mockResolvedValue(null);

      const handler = socket._handlers.get("voice:connect_transport");
      await handler!({ transportId: "t1", dtlsParameters: {} });

      expect(socket.emit).toHaveBeenCalledWith("voice:error", {
        code: "NOT_IN_VOICE",
        message: "Not in a voice room",
      });
    });
  });

  // ── voice:produce ─────────────────────────────────────────────────────────

  describe("voice:produce", () => {
    it("should create producer and return producerId", async () => {
      await registerVoice();

      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ roomId: "channel:ch1" }),
      );
      vi.mocked(rpcToSfu).mockResolvedValue({ producerId: "p1" });

      const handler = socket._handlers.get("voice:produce");
      await handler!({ transportId: "t1", kind: "audio", rtpParameters: {} });

      expect(socket.emit).toHaveBeenCalledWith("voice:produce_ok", {
        producerId: "p1",
      });
    });
  });

  // ── voice:consume_request ─────────────────────────────────────────────────

  describe("voice:consume_request", () => {
    it("should create consumer and emit consumer_ready", async () => {
      await registerVoice();

      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ roomId: "channel:ch1" }),
      );
      vi.mocked(rpcToSfu).mockResolvedValue({
        consumerId: "c1",
        producerId: "p1",
        kind: "audio",
        rtpParameters: {},
      });

      const handler = socket._handlers.get("voice:consume_request");
      await handler!({ producerId: "p1", rtpCapabilities: {} });

      expect(socket.emit).toHaveBeenCalledWith(
        "voice:consumer_ready",
        expect.objectContaining({
          consumerId: "c1",
          producerId: "p1",
        }),
      );
    });
  });
});
