import type { VoiceCommand } from "../redis/subscriber.js";
import { publishResponse } from "../redis/publisher.js";
import { userConsumers } from "../state.js";

interface SetLayersPayload {
  consumerId: string;
  spatialLayer: number;
  temporalLayer?: number;
}

/**
 * Allows the client to select which simulcast layer to receive for a video consumer.
 * spatialLayer 0 = lowest (tiny thumbnail), 2 = highest (full res).
 * Use this when the video tile resizes to save bandwidth.
 */
export async function handleSetPreferredLayers(cmd: VoiceCommand): Promise<void> {
  const { requestId, userId } = cmd;
  const payload = cmd.payload as SetLayersPayload;

  try {
    const consumers = userConsumers.get(userId);
    if (!consumers) throw new Error("No consumers for user");

    const consumer = consumers.find((c) => c.id === payload.consumerId);
    if (!consumer) throw new Error("Consumer not found");

    if (consumer.kind !== "video") {
      throw new Error("Can only set layers on video consumers");
    }

    await consumer.setPreferredLayers({
      spatialLayer: payload.spatialLayer,
      temporalLayer: payload.temporalLayer,
    });

    await publishResponse(requestId, { ok: true, payload: {} });
  } catch (err) {
    const error = err instanceof Error ? err.message : "SET_LAYERS_ERROR";
    await publishResponse(requestId, { ok: false, error });
  }
}
