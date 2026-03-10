import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockRouter, mockWorker } from "../setup.js";
import { roomProducers, roomSpeakerObservers, roomActiveSpeakers } from "../../src/state.js";

// We need to test the rooms module, but it has internal state (a local Map).
// Re-import fresh each test suite run.
import { getOrCreateRoom, getRoom, destroyRoom } from "../../src/mediasoup/rooms.js";

// Workers module is mocked via setup.ts (mediasoup mock)
// but rooms.ts imports getNextWorker, so mock it:
vi.mock("../../src/mediasoup/workers.js", () => ({
  getNextWorker: vi.fn(() => mockWorker),
}));

// Mock publisher (rooms.ts now imports publishNotification for AudioLevelObserver)
vi.mock("../../src/redis/publisher.js", () => ({
  publishResponse: vi.fn(),
  publishNotification: vi.fn(),
}));

describe("rooms", () => {
  beforeEach(() => {
    roomProducers.clear();
    roomSpeakerObservers.clear();
    roomActiveSpeakers.clear();
    // Clean up rooms by destroying any that were created
    // (rooms is a local Map inside rooms.ts, so we destroy known rooms)
    if (getRoom("room-1")) destroyRoom("room-1");
    if (getRoom("room-2")) destroyRoom("room-2");
  });

  describe("getOrCreateRoom", () => {
    it("creates a new room with a router", async () => {
      const router = await getOrCreateRoom("room-1");

      expect(router).toBe(mockRouter);
      expect(mockWorker.createRouter).toHaveBeenCalled();
    });

    it("returns existing room on second call", async () => {
      const first = await getOrCreateRoom("room-1");
      mockWorker.createRouter.mockClear();

      const second = await getOrCreateRoom("room-1");

      expect(second).toBe(first);
      expect(mockWorker.createRouter).not.toHaveBeenCalled();
    });

    it("initializes roomProducers map for the new room", async () => {
      await getOrCreateRoom("room-1");

      expect(roomProducers.has("room-1")).toBe(true);
      expect(roomProducers.get("room-1")?.size).toBe(0);
    });
  });

  describe("getRoom", () => {
    it("returns undefined for non-existent room", () => {
      expect(getRoom("nonexistent")).toBeUndefined();
    });

    it("returns the router for an existing room", async () => {
      await getOrCreateRoom("room-1");
      expect(getRoom("room-1")).toBe(mockRouter);
    });
  });

  describe("destroyRoom", () => {
    it("closes the router and removes the room", async () => {
      await getOrCreateRoom("room-1");

      destroyRoom("room-1");

      expect(mockRouter.close).toHaveBeenCalled();
      expect(getRoom("room-1")).toBeUndefined();
    });

    it("cleans up roomProducers", async () => {
      await getOrCreateRoom("room-1");
      roomProducers.set("room-1", new Map([["p1", {} as any]]));

      destroyRoom("room-1");

      expect(roomProducers.has("room-1")).toBe(false);
    });

    it("is a no-op for non-existent room", () => {
      expect(() => destroyRoom("nonexistent")).not.toThrow();
    });
  });
});
