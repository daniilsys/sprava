import type { Router, RtpCodecCapability, ActiveSpeakerObserver } from "mediasoup/types";
import { getNextWorker } from "./workers.js";
import {
  roomProducers,
  roomActiveSpeakers,
  roomSpeakerObservers,
} from "../state.js";
import { publishNotification } from "../redis/publisher.js";

const rooms = new Map<string, Router>();

/**
 * ActiveSpeakerObserver interval — how often to check who is speaking (ms).
 * Used purely for UI indicators (speaking ring), NOT for pausing audio.
 */
const SPEAKER_OBSERVER_INTERVAL = 300;

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
  roomActiveSpeakers.set(roomId, new Set());

  // ActiveSpeakerObserver — for UI speaking indicators only (no audio pausing)
  const observer = await router.createActiveSpeakerObserver({
    interval: SPEAKER_OBSERVER_INTERVAL,
  });

  setupSpeakerObserver(roomId, observer);
  roomSpeakerObservers.set(roomId, observer);

  console.log(`[rooms] Created router for room ${roomId}`);
  return router;
}

/**
 * ActiveSpeakerObserver emits "dominantspeaker" with the current dominant
 * producer. We map that back to a userId and broadcast to the gateway
 * so the client can show speaking indicators.
 *
 * We do NOT pause/resume audio consumers — Opus at ~32kbps per stream
 * is negligible. Pausing causes audible clipping artifacts.
 */
function setupSpeakerObserver(roomId: string, observer: ActiveSpeakerObserver): void {
  observer.on("dominantspeaker", ({ producer }) => {
    const producerMap = roomProducers.get(roomId);
    if (!producerMap) return;

    const entry = producerMap.get(producer.id);
    if (!entry) return;

    const activeSpeakers = roomActiveSpeakers.get(roomId);
    if (!activeSpeakers) return;

    // Update active speakers — ActiveSpeakerObserver gives us the dominant one
    const prevSpeakers = new Set(activeSpeakers);
    activeSpeakers.clear();
    activeSpeakers.add(entry.userId);

    // Only notify if the dominant speaker changed
    if (prevSpeakers.size !== 1 || !prevSpeakers.has(entry.userId)) {
      publishNotification({
        type: "ACTIVE_SPEAKERS",
        roomId,
        userId: entry.userId,
        payload: { speakers: [entry.userId] },
      }).catch(() => {});
    }
  });
}

/** Returns the Router for a room, or undefined if it doesn't exist. */
export function getRoom(roomId: string): Router | undefined {
  return rooms.get(roomId);
}

/** Closes and removes a room when it's empty. */
export function destroyRoom(roomId: string): void {
  const router = rooms.get(roomId);
  if (!router) return;

  // Clean up observer
  const observer = roomSpeakerObservers.get(roomId);
  if (observer && !observer.closed) observer.close();
  roomSpeakerObservers.delete(roomId);
  roomActiveSpeakers.delete(roomId);

  router.close();
  rooms.delete(roomId);
  roomProducers.delete(roomId);
  console.log(`[rooms] Destroyed room ${roomId}`);
}
