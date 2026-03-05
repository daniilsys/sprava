import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleLeave } from "../../src/handlers/leave.js";
import { publishResponse, publishNotification } from "../../src/redis/publisher.js";
import { destroyRoom } from "../../src/mediasoup/rooms.js";
import {
  userTransports,
  userProducers,
  userConsumers,
  userRooms,
  roomProducers,
} from "../../src/state.js";
import type { VoiceCommand } from "../../src/redis/subscriber.js";

vi.mock("../../src/redis/publisher.js", () => ({
  publishResponse: vi.fn(),
  publishNotification: vi.fn(),
}));

vi.mock("../../src/mediasoup/rooms.js", () => ({
  getOrCreateRoom: vi.fn(),
  getRoom: vi.fn(),
  destroyRoom: vi.fn(),
}));

const makeCmd = (overrides?: Partial<VoiceCommand>): VoiceCommand => ({
  requestId: "req-5",
  type: "LEAVE",
  roomId: "channel:ch1",
  userId: "user-1",
  payload: {},
  ...overrides,
});

describe("handleLeave", () => {
  beforeEach(() => {
    userTransports.clear();
    userProducers.clear();
    userConsumers.clear();
    userRooms.clear();
    roomProducers.clear();
  });

  it("closes all consumers and removes from state", async () => {
    const consumer1 = { close: vi.fn() };
    const consumer2 = { close: vi.fn() };
    userConsumers.set("user-1", [consumer1 as any, consumer2 as any]);

    await handleLeave(makeCmd());

    expect(consumer1.close).toHaveBeenCalled();
    expect(consumer2.close).toHaveBeenCalled();
    expect(userConsumers.has("user-1")).toBe(false);
  });

  it("closes all producers and removes from room index", async () => {
    const producer = { id: "prod-1", close: vi.fn() };
    userProducers.set("user-1", [producer as any]);
    const roomMap = new Map([["prod-1", { userId: "user-1", producer: producer as any }]]);
    roomProducers.set("channel:ch1", roomMap);

    await handleLeave(makeCmd());

    expect(producer.close).toHaveBeenCalled();
    expect(userProducers.has("user-1")).toBe(false);
    expect(roomMap.has("prod-1")).toBe(false);
  });

  it("closes the transport and removes from state", async () => {
    const transport = { close: vi.fn() };
    userTransports.set("user-1", transport as any);

    await handleLeave(makeCmd());

    expect(transport.close).toHaveBeenCalled();
    expect(userTransports.has("user-1")).toBe(false);
  });

  it("removes user from userRooms", async () => {
    userRooms.set("user-1", "channel:ch1");

    await handleLeave(makeCmd());

    expect(userRooms.has("user-1")).toBe(false);
  });

  it("publishes USER_LEFT notification", async () => {
    await handleLeave(makeCmd());

    expect(publishNotification).toHaveBeenCalledWith({
      type: "USER_LEFT",
      roomId: "channel:ch1",
      userId: "user-1",
    });
  });

  it("destroys the room when it becomes empty", async () => {
    roomProducers.set("channel:ch1", new Map());
    // No other users in userRooms pointing to this room

    await handleLeave(makeCmd());

    expect(destroyRoom).toHaveBeenCalledWith("channel:ch1");
  });

  it("does NOT destroy the room if other users remain", async () => {
    roomProducers.set("channel:ch1", new Map());
    userRooms.set("user-2", "channel:ch1"); // another user still in room

    await handleLeave(makeCmd());

    expect(destroyRoom).not.toHaveBeenCalled();
  });

  it("responds with ok on success", async () => {
    await handleLeave(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-5", {
      ok: true,
      payload: {},
    });
  });
});
