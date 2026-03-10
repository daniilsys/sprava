import type { MediaKind, RtpParameters } from "mediasoup/types";
import type { VoiceCommand } from "../redis/subscriber.js";
import { publishResponse, publishNotification } from "../redis/publisher.js";
import { transports, userProducers, userRooms, roomProducers, roomSpeakerObservers } from "../state.js";

interface ProducePayload {
  transportId: string;
  kind: MediaKind;
  rtpParameters: RtpParameters;
}

export async function handleProduce(cmd: VoiceCommand): Promise<void> {
  const { requestId, roomId, userId } = cmd;
  const payload = cmd.payload as ProducePayload;

  try {
    const transport = transports.get(payload.transportId);
    if (!transport) throw new Error("Transport not found");

    // Simulcast is configured client-side via mediasoup-client encodings.
    // The SFU just accepts whatever rtpParameters the client negotiated.
    const producer = await transport.produce({
      kind: payload.kind,
      rtpParameters: payload.rtpParameters,
    });

    // For audio producers: add to ActiveSpeakerObserver for UI speaking indicators
    if (producer.kind === "audio") {
      const observer = roomSpeakerObservers.get(roomId);
      if (observer && !observer.closed) {
        observer.addProducer({ producerId: producer.id }).catch((err) => {
          console.warn(`[produce] Failed to add producer to ActiveSpeakerObserver:`, err);
        });
      }
    }

    // Track producer per user
    const existing = userProducers.get(userId) ?? [];
    existing.push(producer);
    userProducers.set(userId, existing);

    // Track producer in the room index
    const roomMap = roomProducers.get(roomId) ?? new Map();
    roomMap.set(producer.id, { userId, producer });
    roomProducers.set(roomId, roomMap);

    // Clean up when producer closes (e.g. client stops screen share)
    producer.on("transportclose", () => {
      roomMap.delete(producer.id);
      const prods = userProducers.get(userId);
      if (prods) {
        const idx = prods.indexOf(producer);
        if (idx !== -1) prods.splice(idx, 1);
      }
    });

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
