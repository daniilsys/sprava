import type { VoiceCommand } from "../redis/subscriber.js";
import { publishResponse } from "../redis/publisher.js";
import { userConsumers } from "../state.js";

interface PauseConsumerPayload {
  consumerId: string;
  pause: boolean; // true = pause, false = resume
}

/**
 * Allows the client to pause/resume a VIDEO consumer.
 * Use this when a video tile goes off-screen to save bandwidth,
 * and resume when it comes back.
 *
 * Audio consumers should NEVER be paused — Opus is cheap and
 * pausing causes audible clipping.
 */
export async function handlePauseConsumer(cmd: VoiceCommand): Promise<void> {
  const { requestId, userId } = cmd;
  const payload = cmd.payload as PauseConsumerPayload;

  try {
    const consumers = userConsumers.get(userId);
    if (!consumers) throw new Error("No consumers for user");

    const consumer = consumers.find((c) => c.id === payload.consumerId);
    if (!consumer) throw new Error("Consumer not found");

    // Refuse to pause audio consumers
    if (consumer.kind === "audio") {
      throw new Error("Audio consumers cannot be paused");
    }

    if (payload.pause) {
      await consumer.pause();
    } else {
      await consumer.resume();
    }

    await publishResponse(requestId, { ok: true, payload: {} });
  } catch (err) {
    const error = err instanceof Error ? err.message : "PAUSE_CONSUMER_ERROR";
    await publishResponse(requestId, { ok: false, error });
  }
}
