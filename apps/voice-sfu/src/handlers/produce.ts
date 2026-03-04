import type { MediaKind, RtpParameters } from "mediasoup/types";
import type { VoiceCommand } from "../redis/subscriber.js";
import { publishResponse, publishNotification } from "../redis/publisher.js";
import { userTransports, userProducers, userRooms, roomProducers } from "../state.js";

interface ProducePayload {
  transportId: string;
  kind: MediaKind;
  rtpParameters: RtpParameters;
}

export async function handleProduce(cmd: VoiceCommand): Promise<void> {
  const { requestId, roomId, userId } = cmd;
  const payload = cmd.payload as ProducePayload;

  try {
    const transport = userTransports.get(userId);
    if (!transport) throw new Error("Transport not found");

    const producer = await transport.produce({
      kind: payload.kind,
      rtpParameters: payload.rtpParameters,
    });

    // Track producer per user
    const existing = userProducers.get(userId) ?? [];
    existing.push(producer);
    userProducers.set(userId, existing);

    // Track producer in the room index
    const roomMap = roomProducers.get(roomId) ?? new Map();
    roomMap.set(producer.id, { userId, producer });
    roomProducers.set(roomId, roomMap);

    // Notify all other clients in the room via voice:notify
    await publishNotification({
      type: "NEW_PRODUCER",
      roomId,
      userId,
      payload: { producerId: producer.id, kind: producer.kind },
    });

    await publishResponse(requestId, {
      ok: true,
      payload: { producerId: producer.id },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "PRODUCE_ERROR";
    await publishResponse(requestId, { ok: false, error });
  }
}
