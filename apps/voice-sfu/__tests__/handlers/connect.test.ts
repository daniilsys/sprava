import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleConnectTransport } from "../../src/handlers/connect.js";
import { publishResponse } from "../../src/redis/publisher.js";
import { transports } from "../../src/state.js";
import { mockSendTransport } from "../setup.js";
import type { VoiceCommand } from "../../src/redis/subscriber.js";

vi.mock("../../src/redis/publisher.js", () => ({
  publishResponse: vi.fn(),
  publishNotification: vi.fn(),
}));

const dtlsParams = { fingerprints: [], role: "client" as const };

const makeCmd = (overrides?: Partial<VoiceCommand>): VoiceCommand => ({
  requestId: "req-2",
  type: "CONNECT_TRANSPORT",
  roomId: "channel:ch1",
  userId: "user-1",
  payload: { transportId: mockSendTransport.id, dtlsParameters: dtlsParams },
  ...overrides,
});

describe("handleConnectTransport", () => {
  beforeEach(() => {
    transports.clear();
  });

  it("connects the transport with DTLS parameters", async () => {
    transports.set(mockSendTransport.id, mockSendTransport as any);

    await handleConnectTransport(makeCmd());

    expect(mockSendTransport.connect).toHaveBeenCalledWith({
      dtlsParameters: dtlsParams,
    });
    expect(publishResponse).toHaveBeenCalledWith("req-2", {
      ok: true,
      payload: {},
    });
  });

  it("responds with error if transport not found", async () => {
    await handleConnectTransport(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-2", {
      ok: false,
      error: "Transport not found",
    });
  });

  it("responds with error on connect failure", async () => {
    transports.set(mockSendTransport.id, mockSendTransport as any);
    mockSendTransport.connect.mockRejectedValueOnce(new Error("DTLS failed"));

    await handleConnectTransport(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-2", {
      ok: false,
      error: "DTLS failed",
    });
  });
});
