import type { Router, RtpCodecCapability } from "mediasoup/types";
import { getNextWorker } from "./workers.js";
import { roomProducers } from "../state.js";

const rooms = new Map<string, Router>();

// preferredPayloadType is assigned by mediasoup internally — we omit it here
const mediaCodecs = [
  {
    kind: "audio" as const,
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video" as const,
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {},
  },
  {
    kind: "video" as const,
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
    },
  },
] as RtpCodecCapability[];

/** Returns the existing Router for a room, or creates a new one. */
export async function getOrCreateRoom(roomId: string): Promise<Router> {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const worker = getNextWorker();
  const router = await worker.createRouter({ mediaCodecs });
  rooms.set(roomId, router);
  roomProducers.set(roomId, new Map());
  console.log(`[rooms] Created router for room ${roomId}`);
  return router;
}

/** Returns the Router for a room, or undefined if it doesn't exist. */
export function getRoom(roomId: string): Router | undefined {
  return rooms.get(roomId);
}

/** Closes and removes a room when it's empty. */
export function destroyRoom(roomId: string): void {
  const router = rooms.get(roomId);
  if (!router) return;
  router.close();
  rooms.delete(roomId);
  roomProducers.delete(roomId);
  console.log(`[rooms] Destroyed room ${roomId}`);
}
