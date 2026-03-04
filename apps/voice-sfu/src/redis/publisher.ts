import Redis from "ioredis";
import type { VoiceResponse, VoiceNotification } from "./subscriber.js";

export const pub = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
);

export async function publishResponse(
  requestId: string,
  response: Omit<VoiceResponse, "requestId">,
): Promise<void> {
  const msg: VoiceResponse = { requestId, ...response };
  await pub.publish(`voice:res:${requestId}`, JSON.stringify(msg));
}

export async function publishNotification(
  notification: VoiceNotification,
): Promise<void> {
  await pub.publish("voice:notify", JSON.stringify(notification));
}
