import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleProduce } from "../../src/handlers/produce.js";
import { publishResponse, publishNotification } from "../../src/redis/publisher.js";
import { transports, userProducers, userRooms, roomProducers } from "../../src/state.js";
import { mockSendTransport, mockProducer } from "../setup.js";
import type { VoiceCommand } from "../../src/redis/subscriber.js";

vi.mock("../../src/redis/publisher.js", () => ({
  publishResponse: vi.fn(),
  publishNotification: vi.fn(),
}));

const makeCmd = (overrides?: Partial<VoiceCommand>): VoiceCommand => ({
  requestId: "req-3",
  type: "PRODUCE",
  roomId: "channel:ch1",
  userId: "user-1",
  payload: {
    transportId: mockSendTransport.id,
    kind: "audio",
    rtpParameters: { codecs: [], headerExtensions: [], encodings: [], rtcp: {} },
  },
  ...overrides,
});

describe("handleProduce", () => {
  beforeEach(() => {
    transports.clear();
    userProducers.clear();
    userRooms.clear();
    roomProducers.clear();
  });

  it("creates a producer and stores it per-user and per-room", async () => {
    transports.set(mockSendTransport.id, mockSendTransport as any);

    await handleProduce(makeCmd());

    expect(mockSendTransport.produce).toHaveBeenCalledWith({
      kind: "audio",
      rtpParameters: expect.any(Object),
    });
    expect(userProducers.get("user-1")).toContain(mockProducer);
    expect(roomProducers.get("channel:ch1")?.has(mockProducer.id)).toBe(true);
  });

  it("publishes NEW_PRODUCER notification", async () => {
    transports.set(mockSendTransport.id, mockSendTransport as any);

    await handleProduce(makeCmd());

    expect(publishNotification).toHaveBeenCalledWith({
      type: "NEW_PRODUCER",
      roomId: "channel:ch1",
      userId: "user-1",
      payload: { producerId: mockProducer.id, kind: mockProducer.kind },
    });
  });

  it("responds with producerId", async () => {
    transports.set(mockSendTransport.id, mockSendTransport as any);

    await handleProduce(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-3", {
      ok: true,
      payload: { producerId: mockProducer.id },
    });
  });

  it("responds with error if transport not found", async () => {
    await handleProduce(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-3", {
      ok: false,
      error: "Transport not found",
    });
  });

  it("appends to existing producers list", async () => {
    transports.set(mockSendTransport.id, mockSendTransport as any);
    const existingProducer = { id: "old-prod", kind: "video", close: vi.fn() } as any;
    userProducers.set("user-1", [existingProducer]);

    await handleProduce(makeCmd());

    expect(userProducers.get("user-1")).toHaveLength(2);
  });
});
