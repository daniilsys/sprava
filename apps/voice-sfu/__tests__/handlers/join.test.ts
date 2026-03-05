import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleJoin } from "../../src/handlers/join.js";
import { publishResponse } from "../../src/redis/publisher.js";
import { userTransports, userRooms, roomProducers } from "../../src/state.js";
import { mockRouter, mockTransport } from "../setup.js";
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

import { getOrCreateRoom } from "../../src/mediasoup/rooms.js";

const makeCmd = (overrides?: Partial<VoiceCommand>): VoiceCommand => ({
  requestId: "req-1",
  type: "JOIN",
  roomId: "channel:ch1",
  userId: "user-1",
  payload: {},
  ...overrides,
});

describe("handleJoin", () => {
  beforeEach(() => {
    userTransports.clear();
    userRooms.clear();
    roomProducers.clear();
    vi.mocked(getOrCreateRoom).mockResolvedValue(mockRouter as any);
  });

  it("creates a transport and stores it in state", async () => {
    await handleJoin(makeCmd());

    expect(userTransports.get("user-1")).toBe(mockTransport);
    expect(userRooms.get("user-1")).toBe("channel:ch1");
  });

  it("responds with transportParams and routerRtpCapabilities", async () => {
    await handleJoin(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-1", {
      ok: true,
      payload: {
        transportParams: {
          id: mockTransport.id,
          iceParameters: mockTransport.iceParameters,
          iceCandidates: mockTransport.iceCandidates,
          dtlsParameters: mockTransport.dtlsParameters,
        },
        routerRtpCapabilities: mockRouter.rtpCapabilities,
        existingProducers: [],
      },
    });
  });

  it("includes existing producers in the response", async () => {
    const fakeProducer = { kind: "audio" as const, id: "prod-99" };
    roomProducers.set(
      "channel:ch1",
      new Map([["prod-99", { userId: "user-2", producer: fakeProducer as any }]]),
    );

    await handleJoin(makeCmd());

    const call = vi.mocked(publishResponse).mock.calls[0];
    const payload = (call[1] as any).payload;
    expect(payload.existingProducers).toEqual([
      { producerId: "prod-99", userId: "user-2", kind: "audio" },
    ]);
  });

  it("closes stale transport on reconnect", async () => {
    const staleTransport = { close: vi.fn() } as any;
    userTransports.set("user-1", staleTransport);

    await handleJoin(makeCmd());

    expect(staleTransport.close).toHaveBeenCalled();
    expect(userTransports.get("user-1")).toBe(mockTransport);
  });

  it("responds with error on failure", async () => {
    mockRouter.createWebRtcTransport.mockRejectedValueOnce(new Error("boom"));

    await handleJoin(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-1", {
      ok: false,
      error: "boom",
    });
  });
});
