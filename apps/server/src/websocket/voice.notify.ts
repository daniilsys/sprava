import Redis from "ioredis";
import type { Server } from "socket.io";
import { redis } from "../config/redis.js";
import { logger } from "../config/logger.js";
import type { VoiceNotification } from "./voice.redis.js";

/**
 * Starts the voice:notify subscriber once at boot.
 * Relays SFU-initiated events (new producer, crash disconnects) to clients.
 */
export function startVoiceNotifySubscriber(io: Server): void {
  const sub = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

  sub.subscribe("voice:notify", (err) => {
    if (err) logger.error({ err }, "voice:notify subscribe error");
  });

  sub.on("message", async (_, msg) => {
    let notif: VoiceNotification;
    try {
      notif = JSON.parse(msg) as VoiceNotification;
    } catch {
      return;
    }

    if (notif.type === "NEW_PRODUCER") {
      const payload = notif.payload as {
        producerId: string;
        kind: string;
      };
      io.to(`voice:${notif.roomId}`).emit("voice:new_producer", {
        producerId: payload.producerId,
        userId: notif.userId,
        kind: payload.kind,
      });
    }

    if (notif.type === "USER_LEFT") {
      // SFU-initiated leave (crash / transport timeout) — clean up Redis state
      await Promise.all([
        redis.del(`voice:user:${notif.userId}`),
        redis.srem(`voice:room:${notif.roomId}:members`, notif.userId),
      ]);

      io.to(`voice:${notif.roomId}`).emit("voice:user_left", {
        userId: notif.userId,
        roomId: notif.roomId,
      });

      // For DM rooms: check if the call is now empty
      if (notif.roomId.startsWith("dm:")) {
        const dmConversationId = notif.roomId.slice(3);
        const remaining = await redis.scard(
          `voice:room:${notif.roomId}:members`,
        );
        if (remaining === 0) {
          io.to(`dm:${dmConversationId}`).emit("voice:dm_call_ended", {
            dmConversationId,
          });
        }
      }
    }
  });
}
