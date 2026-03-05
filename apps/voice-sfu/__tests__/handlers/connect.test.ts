import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleConnectTransport } from "../../src/handlers/connect.js";
import { publishResponse } from "../../src/redis/publisher.js";
import { userTransports } from "../../src/state.js";
import { mockTransport } from "../setup.js";
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
  payload: { transportId: "transport-1", dtlsParameters: dtlsParams },
  ...overrides,
});

describe("handleConnectTransport", () => {
  beforeEach(() => {
    userTransports.clear();
  });

  it("connects the transport with DTLS parameters", async () => {
    userTransports.set("user-1", mockTransport as any);

    await handleConnectTransport(makeCmd());

    expect(mockTransport.connect).toHaveBeenCalledWith({
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
    userTransports.set("user-1", mockTransport as any);
    mockTransport.connect.mockRejectedValueOnce(new Error("DTLS failed"));

    await handleConnectTransport(makeCmd());

    expect(publishResponse).toHaveBeenCalledWith("req-2", {
      ok: false,
      error: "DTLS failed",
    });
  });
});
