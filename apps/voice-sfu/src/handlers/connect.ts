import type { DtlsParameters } from "mediasoup/types";
import type { VoiceCommand } from "../redis/subscriber.js";
import { publishResponse } from "../redis/publisher.js";
import { userTransports } from "../state.js";

interface ConnectPayload {
  transportId: string;
  dtlsParameters: DtlsParameters;
}

export async function handleConnectTransport(
  cmd: VoiceCommand,
): Promise<void> {
  const { requestId, userId } = cmd;
  const payload = cmd.payload as ConnectPayload;

  try {
    const transport = userTransports.get(userId);
    if (!transport) throw new Error("Transport not found");

    await transport.connect({ dtlsParameters: payload.dtlsParameters });

    await publishResponse(requestId, { ok: true, payload: {} });
  } catch (err) {
    const error = err instanceof Error ? err.message : "CONNECT_ERROR";
    await publishResponse(requestId, { ok: false, error });
  }
}
