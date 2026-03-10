import type { VoiceCommand } from "../redis/subscriber.js";
import { publishResponse } from "../redis/publisher.js";
import { userConsumers } from "../state.js";

interface ResumePayload {
  consumerId: string;
}

/**
 * Client calls this after it has set up its MediaStream for a consumer.
 * Ensures the consumer is resumed server-side (in case it was paused).
 */
export async function handleResumeConsumer(cmd: VoiceCommand): Promise<void> {
  const { requestId, userId } = cmd;
  const payload = cmd.payload as ResumePayload;

  try {
    const consumers = userConsumers.get(userId);
    if (!consumers) throw new Error("No consumers for user");

    const consumer = consumers.find((c) => c.id === payload.consumerId);
    if (!consumer) throw new Error("Consumer not found");

    if (consumer.paused) {
      await consumer.resume();
    }

    await publishResponse(requestId, { ok: true, payload: {} });
  } catch (err) {
    const error = err instanceof Error ? err.message : "RESUME_ERROR";
    await publishResponse(requestId, { ok: false, error });
  }
}
