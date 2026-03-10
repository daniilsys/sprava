import Redis from "ioredis";
import { handleJoin } from "../handlers/join.js";
import { handleConnectTransport } from "../handlers/connect.js";
import { handleProduce } from "../handlers/produce.js";
import { handleConsume } from "../handlers/consume.js";
import { handleLeave } from "../handlers/leave.js";
import { handleResumeConsumer } from "../handlers/resume.js";
import { handleSetPreferredLayers } from "../handlers/setLayers.js";
import { handlePauseConsumer } from "../handlers/pauseConsumer.js";

// ─── Protocol types (shared with Server A) ───────────────────────────────────

export interface VoiceCommand {
  requestId: string;
  type: "JOIN" | "CONNECT_TRANSPORT" | "PRODUCE" | "CONSUME" | "LEAVE" | "RESUME_CONSUMER" | "SET_PREFERRED_LAYERS" | "PAUSE_CONSUMER";
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

// ─── Subscriber setup ─────────────────────────────────────────────────────────

let sub: Redis | null = null;

export function startCommandSubscriber(): void {
  sub = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

  sub.subscribe("voice:cmd", (err) => {
    if (err) {
      console.error("[subscriber] Failed to subscribe to voice:cmd:", err);
      return;
    }
    console.log("[subscriber] Listening on voice:cmd");
  });

  sub.on("message", (channel, msg) => {
    if (channel !== "voice:cmd") return;

    let cmd: VoiceCommand;
    try {
      cmd = JSON.parse(msg) as VoiceCommand;
    } catch {
      console.error("[subscriber] Failed to parse command:", msg);
      return;
    }

    dispatch(cmd).catch((err) => {
      console.error(`[subscriber] Unhandled error in ${cmd.type}:`, err);
    });
  });
}

/** Close the subscriber connection (for graceful shutdown). */
export async function stopCommandSubscriber(): Promise<void> {
  if (sub) {
    await sub.unsubscribe("voice:cmd");
    sub.disconnect();
    sub = null;
  }
}

async function dispatch(cmd: VoiceCommand): Promise<void> {
  switch (cmd.type) {
    case "JOIN":
      await handleJoin(cmd);
      break;
    case "CONNECT_TRANSPORT":
      await handleConnectTransport(cmd);
      break;
    case "PRODUCE":
      await handleProduce(cmd);
      break;
    case "CONSUME":
      await handleConsume(cmd);
      break;
    case "LEAVE":
      await handleLeave(cmd);
      break;
    case "RESUME_CONSUMER":
      await handleResumeConsumer(cmd);
      break;
    case "SET_PREFERRED_LAYERS":
      await handleSetPreferredLayers(cmd);
      break;
    case "PAUSE_CONSUMER":
      await handlePauseConsumer(cmd);
      break;
    default:
      console.warn(`[subscriber] Unknown command type: ${(cmd as VoiceCommand).type}`);
  }
}
