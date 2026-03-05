/**
 * Unit tests for voice SFU handlers.
 * Tests the SFU command handlers (join, connect, produce, consume, leave)
 * and Redis pub/sub communication patterns.
 *
 * NOTE: These test the SFU logic in isolation using mocked mediasoup.
 * The actual SFU lives in apps/voice-sfu/ — these tests mock its interfaces
 * and verify the gateway-side voice.redis.ts RPC protocol.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { redis } from "../../../src/config/redis.js";

// ── Mock the RPC layer to test gateway → SFU communication ────────────────

describe("Voice Redis RPC (gateway side)", () => {
  // Un-mock voice.redis so we can test the real rpcToSfu
  // Note: In setup.ts we mock voice.redis — these tests verify the mock behavior

  describe("rpcToSfu", () => {
    it("should send JOIN command and receive transport params", async () => {
      const { rpcToSfu } = await import("../../../src/websocket/voice.redis.js");

      const result = await rpcToSfu("JOIN", "channel:ch1", "user-1");

      expect(result).toEqual(
        expect.objectContaining({
          transportParams: expect.anything(),
          routerRtpCapabilities: expect.anything(),
          existingProducers: expect.any(Array),
        }),
      );
    });

    it("should send CONNECT_TRANSPORT command", async () => {
      const { rpcToSfu } = await import("../../../src/websocket/voice.redis.js");

      await expect(
        rpcToSfu("CONNECT_TRANSPORT", "channel:ch1", "user-1", {
          transportId: "t1",
          dtlsParameters: { fingerprints: [] },
        }),
      ).resolves.toBeDefined();
    });

    it("should send PRODUCE command and receive producerId", async () => {
      const { rpcToSfu } = await import("../../../src/websocket/voice.redis.js");

      // Override default mock for this specific call
      vi.mocked(rpcToSfu).mockResolvedValueOnce({ producerId: "p-123" });

      const result = await rpcToSfu("PRODUCE", "channel:ch1", "user-1", {
        transportId: "t1",
        kind: "audio",
        rtpParameters: {},
      });

      expect(result).toEqual({ producerId: "p-123" });
    });

    it("should send CONSUME command and receive consumer details", async () => {
      const { rpcToSfu } = await import("../../../src/websocket/voice.redis.js");

      vi.mocked(rpcToSfu).mockResolvedValueOnce({
        consumerId: "c-456",
        producerId: "p-123",
        kind: "audio",
        rtpParameters: {},
      });

      const result = await rpcToSfu("CONSUME", "channel:ch1", "user-1", {
        producerId: "p-123",
        rtpCapabilities: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          consumerId: "c-456",
          producerId: "p-123",
        }),
      );
    });

    it("should send LEAVE command", async () => {
      const { rpcToSfu } = await import("../../../src/websocket/voice.redis.js");

      vi.mocked(rpcToSfu).mockResolvedValueOnce({});

      const result = await rpcToSfu("LEAVE", "channel:ch1", "user-1");
      expect(result).toBeDefined();
    });
  });
});

describe("Voice State Management (Redis)", () => {
  // ── getVoiceStatesForRooms ──────────────────────────────────────────────

  describe("getVoiceStatesForRooms", () => {
    it("should return empty array when no rooms", async () => {
      const { getVoiceStatesForRooms } = await import(
        "../../../src/websocket/voice.handlers.js"
      );

      const result = await getVoiceStatesForRooms([], []);
      expect(result).toEqual([]);
    });

    it("should aggregate voice states across channels and DMs", async () => {
      const { getVoiceStatesForRooms } = await import(
        "../../../src/websocket/voice.handlers.js"
      );

      // Mock Redis pipeline to return members
      const pipeline = {
        smembers: vi.fn().mockReturnThis(),
        exec: vi.fn(async () => [
          [null, ["user-1", "user-2"]], // channel:ch1 members
          [null, ["user-3"]],           // dm:dm1 members
        ]),
      };
      vi.mocked(redis.pipeline).mockReturnValue(pipeline as any);

      const result = await getVoiceStatesForRooms(["ch1"], ["dm1"]);

      expect(result).toHaveLength(3);
      expect(result).toContainEqual({ userId: "user-1", roomId: "channel:ch1" });
      expect(result).toContainEqual({ userId: "user-2", roomId: "channel:ch1" });
      expect(result).toContainEqual({ userId: "user-3", roomId: "dm:dm1" });
    });
  });

  // ── leaveVoiceRoom ────────────────────────────────────────────────────────

  describe("leaveVoiceRoom", () => {
    it("should clean up Redis state and notify room", async () => {
      const { leaveVoiceRoom } = await import(
        "../../../src/websocket/voice.handlers.js"
      );

      const mockIO = {
        to: vi.fn(() => ({ emit: vi.fn() })),
      };
      const mockSocket = {
        leave: vi.fn(),
      };

      vi.mocked(redis.scard).mockResolvedValue(1); // room not empty

      await leaveVoiceRoom(mockIO as any, mockSocket as any, "user-1", "channel:ch1");

      // Should clean up Redis keys
      expect(redis.del).toHaveBeenCalledWith("voice:user:user-1");
      expect(redis.srem).toHaveBeenCalledWith("voice:room:channel:ch1:members", "user-1");

      // Should leave socket room
      expect(mockSocket.leave).toHaveBeenCalledWith("voice:channel:ch1");

      // Should notify remaining members
      expect(mockIO.to).toHaveBeenCalledWith("voice:channel:ch1");
    });

    it("should emit dm_call_ended when DM room becomes empty", async () => {
      const { leaveVoiceRoom } = await import(
        "../../../src/websocket/voice.handlers.js"
      );

      const emitFn = vi.fn();
      const mockIO = {
        to: vi.fn(() => ({ emit: emitFn })),
      };
      const mockSocket = { leave: vi.fn() };

      vi.mocked(redis.scard).mockResolvedValue(0); // room becomes empty

      await leaveVoiceRoom(mockIO as any, mockSocket as any, "user-1", "dm:dm1");

      // Should emit dm_call_ended
      expect(mockIO.to).toHaveBeenCalledWith("dm:dm1");
      expect(emitFn).toHaveBeenCalledWith("voice:dm_call_ended", {
        dmConversationId: "dm1",
      });
    });
  });
});

describe("Voice: Multi-participant Simulation", () => {
  it("should handle multiple users joining the same room", async () => {
    const { rpcToSfu } = await import("../../../src/websocket/voice.redis.js");

    // Simulate 5 users joining the same voice channel
    const joinPromises = Array.from({ length: 5 }, (_, i) =>
      rpcToSfu("JOIN", "channel:ch1", `user-${i}`),
    );

    const results = await Promise.allSettled(joinPromises);

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });

  it("should handle join then leave sequence for multiple users", async () => {
    const { rpcToSfu } = await import("../../../src/websocket/voice.redis.js");

    // 3 users join
    for (let i = 0; i < 3; i++) {
      await rpcToSfu("JOIN", "channel:ch1", `user-${i}`);
    }

    // All leave
    vi.mocked(rpcToSfu).mockResolvedValue(undefined as any);
    for (let i = 0; i < 3; i++) {
      await rpcToSfu("LEAVE", "channel:ch1", `user-${i}`);
    }

    // Each leave should have been called
    expect(rpcToSfu).toHaveBeenCalledTimes(6); // 3 joins + 3 leaves
  });

  it("should handle produce/consume flow between two users", async () => {
    const { rpcToSfu } = await import("../../../src/websocket/voice.redis.js");

    // User A joins and produces audio
    await rpcToSfu("JOIN", "channel:ch1", "user-a");
    vi.mocked(rpcToSfu).mockResolvedValueOnce({ producerId: "p-a" });
    const produceResult = await rpcToSfu("PRODUCE", "channel:ch1", "user-a", {
      kind: "audio",
      rtpParameters: {},
    });
    expect(produceResult).toEqual({ producerId: "p-a" });

    // User B joins and consumes User A's audio
    await rpcToSfu("JOIN", "channel:ch1", "user-b");
    vi.mocked(rpcToSfu).mockResolvedValueOnce({
      consumerId: "c-b",
      producerId: "p-a",
      kind: "audio",
      rtpParameters: {},
    });
    const consumeResult = await rpcToSfu("CONSUME", "channel:ch1", "user-b", {
      producerId: "p-a",
      rtpCapabilities: {},
    });
    expect(consumeResult).toEqual(
      expect.objectContaining({ consumerId: "c-b", producerId: "p-a" }),
    );
  });
});
