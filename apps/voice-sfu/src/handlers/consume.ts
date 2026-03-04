import type { RtpCapabilities } from "mediasoup/types";
import type { VoiceCommand } from "../redis/subscriber.js";
import { publishResponse } from "../redis/publisher.js";
import { getRoom } from "../mediasoup/rooms.js";
import { userTransports, userConsumers, roomProducers } from "../state.js";

interface ConsumePayload {
  producerId: string;
  rtpCapabilities: RtpCapabilities;
}

export async function handleConsume(cmd: VoiceCommand): Promise<void> {
  const { requestId, roomId, userId } = cmd;
  const payload = cmd.payload as ConsumePayload;

  try {
    const router = getRoom(roomId);
    if (!router) throw new Error("Room not found");

    const transport = userTransports.get(userId);
    if (!transport) throw new Error("Transport not found");

    // Verify the producer exists in this room
    const roomMap = roomProducers.get(roomId);
    if (!roomMap?.has(payload.producerId)) {
      throw new Error("Producer not found in room");
    }

    if (!router.canConsume({ producerId: payload.producerId, rtpCapabilities: payload.rtpCapabilities })) {
      throw new Error("Cannot consume: incompatible RTP capabilities");
    }

    const consumer = await transport.consume({
      producerId: payload.producerId,
      rtpCapabilities: payload.rtpCapabilities,
      paused: false,
    });

    // Track consumer per user
    const existing = userConsumers.get(userId) ?? [];
    existing.push(consumer);
    userConsumers.set(userId, existing);

    await publishResponse(requestId, {
      ok: true,
      payload: {
        consumerId: consumer.id,
        producerId: payload.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "CONSUME_ERROR";
    await publishResponse(requestId, { ok: false, error });
  }
}
