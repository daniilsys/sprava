import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleJoin } from "../../src/handlers/join.js";
import { publishResponse } from "../../src/redis/publisher.js";
import { transports, userTransportIds, userRooms, roomProducers } from "../../src/state.js";
import { mockRouter, mockSendTransport, mockRecvTransport } from "../setup.js";
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
    transports.clear();
    userTransportIds.clear();
    userRooms.clear();
    roomProducers.clear();
    vi.mocked(getOrCreateRoom).mockResolvedValue(mockRouter as any);
  });

  it("creates send and recv transports and stores them in state", async () => {
    await handleJoin(makeCmd());

    expect(transports.get(mockSendTransport.id)).toBe(mockSendTransport);
    expect(transports.get(mockRecvTransport.id)).toBe(mockRecvTransport);
    expect(userTransportIds.get("user-1")).toEqual([mockSendTransport.id, mockRecvTransport.id]);
    expect(userRooms.get("user-1")).toBe("channel:ch1");
  });

  it("responds with sendTransportOptions, recvTransportOptions and routerRtpCapabilities", async () => {
    await handleJoin(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-1", {
      ok: true,
      payload: {
        sendTransportOptions: {
          id: mockSendTransport.id,
          iceParameters: mockSendTransport.iceParameters,
          iceCandidates: mockSendTransport.iceCandidates,
          dtlsParameters: mockSendTransport.dtlsParameters,
        },
        recvTransportOptions: {
          id: mockRecvTransport.id,
          iceParameters: mockRecvTransport.iceParameters,
          iceCandidates: mockRecvTransport.iceCandidates,
          dtlsParameters: mockRecvTransport.dtlsParameters,
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

  it("closes stale transports on reconnect", async () => {
    const staleTransport = { close: vi.fn() } as any;
    transports.set("stale-t1", staleTransport);
    userTransportIds.set("user-1", ["stale-t1"]);

    await handleJoin(makeCmd());

    expect(staleTransport.close).toHaveBeenCalled();
    expect(transports.has("stale-t1")).toBe(false);
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
