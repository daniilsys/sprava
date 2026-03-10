import { randomUUID } from "crypto";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Redis from "ioredis";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Dedicated pub/sub clients (a subscribed client cannot run other commands)
const redisPub = new Redis(REDIS_URL);
const redisSub = new Redis(REDIS_URL);

// ─── Internal protocol types ──────────────────────────────────────────────────

export interface VoiceCommand {
  requestId: string;
  type: "JOIN" | "CONNECT_TRANSPORT" | "PRODUCE" | "CONSUME" | "LEAVE" | "SET_PREFERRED_LAYERS" | "PAUSE_CONSUMER" | "RESUME_CONSUMER";
  roomId: string;
  userId: string;
  payload: unknown;
}

export interface VoiceResponse {
  requestId: string;
  ok: boolean;
  error?: string;
  payload?: unknown;
}

export interface VoiceNotification {
  type: "NEW_PRODUCER" | "USER_LEFT" | "ACTIVE_SPEAKERS";
  roomId: string;
  userId: string;
  payload?: unknown;
}

// ─── RPC helper ───────────────────────────────────────────────────────────────

/**
 * Sends a command to the voice SFU via Redis pub/sub and waits for a response.
 * Each call gets a unique requestId; the SFU replies on voice:res:{requestId}.
 */
export async function rpcToSfu<T>(
  type: VoiceCommand["type"],
  roomId: string,
  userId: string,
  payload: unknown = {},
  timeoutMs = 5000,
): Promise<T> {
  const requestId = randomUUID();
  const responseChannel = `voice:res:${requestId}`;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      redisSub.unsubscribe(responseChannel).catch(() => {});
      redisSub.off("message", onMessage);
      reject(new Error("SFU_TIMEOUT"));
    }, timeoutMs);

    function onMessage(ch: string, msg: string) {
      if (ch !== responseChannel) return;
      clearTimeout(timer);
      redisSub.unsubscribe(responseChannel).catch(() => {});
      redisSub.off("message", onMessage);
      const res = JSON.parse(msg) as VoiceResponse;
      if (res.ok) {
        resolve(res.payload as T);
      } else {
        reject(new Error(res.error ?? "SFU_ERROR"));
      }
    }

    redisSub.subscribe(responseChannel, (err) => {
      if (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }
      redisSub.on("message", onMessage);
      const cmd: VoiceCommand = { requestId, type, roomId, userId, payload };
      redisPub.publish("voice:cmd", JSON.stringify(cmd)).catch(reject);
    });
  });
}
