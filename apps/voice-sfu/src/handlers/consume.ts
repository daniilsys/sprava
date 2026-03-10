import type { RtpCapabilities } from "mediasoup/types";
import type { VoiceCommand } from "../redis/subscriber.js";
import { publishResponse } from "../redis/publisher.js";
import { getRoom } from "../mediasoup/rooms.js";
import {
  transports,
  userTransportIds,
  userConsumers,
  roomProducers,
} from "../state.js";

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

    // Recv transport is the second transport created for this user
    const ids = userTransportIds.get(userId);
    if (!ids || ids.length < 2) throw new Error("Transport not found");
    const transport = transports.get(ids[1]);
    if (!transport) throw new Error("Transport not found");

    // Verify the producer exists in this room
    const roomMap = roomProducers.get(roomId);
    const producerEntry = roomMap?.get(payload.producerId);
    if (!producerEntry) {
      throw new Error("Producer not found in room");
    }

    if (!router.canConsume({ producerId: payload.producerId, rtpCapabilities: payload.rtpCapabilities })) {
      throw new Error("Cannot consume: incompatible RTP capabilities");
    }

    // All consumers start UNPAUSED.
    // Audio: Opus is ~32kbps per stream — pausing causes audible clipping,
    //        so we never pause audio consumers. The cost is negligible.
    // Video: Starts unpaused; client can request SET_PREFERRED_LAYERS to
    //        switch simulcast quality, or PAUSE_CONSUMER to stop video
    //        when tiles are off-screen.
    const consumer = await transport.consume({
      producerId: payload.producerId,
      rtpCapabilities: payload.rtpCapabilities,
      paused: false,
    });

    // For video consumers with simulcast: prefer middle layer initially
    if (consumer.kind === "video" && consumer.type === "simulcast") {
      consumer.setPreferredLayers({ spatialLayer: 1, temporalLayer: 1 }).catch(() => {});
    }

    // Track consumer per user
    const existing = userConsumers.get(userId) ?? [];
    existing.push(consumer);
    userConsumers.set(userId, existing);

    // Auto-cleanup on transport/producer close
    const cleanup = () => {
      const cons = userConsumers.get(userId);
      if (cons) {
        const idx = cons.indexOf(consumer);
        if (idx !== -1) cons.splice(idx, 1);
      }
    };
    consumer.on("transportclose", cleanup);
    consumer.on("producerclose", cleanup);

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
