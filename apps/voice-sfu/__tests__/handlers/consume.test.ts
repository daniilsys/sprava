import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleConsume } from "../../src/handlers/consume.js";
import { publishResponse } from "../../src/redis/publisher.js";
import { userTransports, userConsumers, roomProducers } from "../../src/state.js";
import { mockTransport, mockConsumer, mockRouter } from "../setup.js";
import type { VoiceCommand } from "../../src/redis/subscriber.js";

vi.mock("../../src/redis/publisher.js", () => ({
  publishResponse: vi.fn(),
  publishNotification: vi.fn(),
}));

// Mock rooms module so getRoom returns our mockRouter
vi.mock("../../src/mediasoup/rooms.js", () => ({
  getOrCreateRoom: vi.fn(),
  getRoom: vi.fn(),
  destroyRoom: vi.fn(),
}));

import { getRoom } from "../../src/mediasoup/rooms.js";

const makeCmd = (overrides?: Partial<VoiceCommand>): VoiceCommand => ({
  requestId: "req-4",
  type: "CONSUME",
  roomId: "channel:ch1",
  userId: "user-1",
  payload: {
    producerId: "producer-1",
    rtpCapabilities: { codecs: [], headerExtensions: [] },
  },
  ...overrides,
});

describe("handleConsume", () => {
  beforeEach(() => {
    userTransports.clear();
    userConsumers.clear();
    roomProducers.clear();
  });

  it("creates a consumer and stores it per-user", async () => {
    vi.mocked(getRoom).mockReturnValue(mockRouter as any);
    userTransports.set("user-1", mockTransport as any);
    roomProducers.set("channel:ch1", new Map([["producer-1", { userId: "user-2", producer: {} as any }]]));

    await handleConsume(makeCmd());

    expect(mockTransport.consume).toHaveBeenCalledWith({
      producerId: "producer-1",
      rtpCapabilities: expect.any(Object),
      paused: false,
    });
    expect(userConsumers.get("user-1")).toContain(mockConsumer);
  });

  it("responds with consumer details", async () => {
    vi.mocked(getRoom).mockReturnValue(mockRouter as any);
    userTransports.set("user-1", mockTransport as any);
    roomProducers.set("channel:ch1", new Map([["producer-1", { userId: "user-2", producer: {} as any }]]));

    await handleConsume(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-4", {
      ok: true,
      payload: {
        consumerId: mockConsumer.id,
        producerId: "producer-1",
        kind: mockConsumer.kind,
        rtpParameters: mockConsumer.rtpParameters,
      },
    });
  });

  it("responds with error if room not found", async () => {
    vi.mocked(getRoom).mockReturnValue(undefined);

    await handleConsume(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-4", {
      ok: false,
      error: "Room not found",
    });
  });

  it("responds with error if transport not found", async () => {
    vi.mocked(getRoom).mockReturnValue(mockRouter as any);
    roomProducers.set("channel:ch1", new Map([["producer-1", { userId: "user-2", producer: {} as any }]]));

    await handleConsume(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-4", {
      ok: false,
      error: "Transport not found",
    });
  });

  it("responds with error if producer not in room", async () => {
    vi.mocked(getRoom).mockReturnValue(mockRouter as any);
    userTransports.set("user-1", mockTransport as any);
    roomProducers.set("channel:ch1", new Map());

    await handleConsume(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-4", {
      ok: false,
      error: "Producer not found in room",
    });
  });

  it("responds with error if canConsume returns false", async () => {
    vi.mocked(getRoom).mockReturnValue(mockRouter as any);
    userTransports.set("user-1", mockTransport as any);
    roomProducers.set("channel:ch1", new Map([["producer-1", { userId: "user-2", producer: {} as any }]]));
    mockRouter.canConsume.mockReturnValueOnce(false);

    await handleConsume(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-4", {
      ok: false,
      error: "Cannot consume: incompatible RTP capabilities",
    });
  });
});
