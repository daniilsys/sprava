import type {
  WebRtcTransport,
  Producer,
  Consumer,
  ActiveSpeakerObserver,
} from "mediasoup/types";

// Transports keyed by transportId (each user has send + recv)
export const transports = new Map<string, WebRtcTransport>();

// userId → list of transportIds (for cleanup on leave)
export const userTransportIds = new Map<string, string[]>();

export const userProducers = new Map<string, Producer[]>();
export const userConsumers = new Map<string, Consumer[]>();

/** userId → roomId — lets us know which room to clean up on leave */
export const userRooms = new Map<string, string>();

/**
 * roomId → Map<producerId, { userId, producer }>
 * Used to list existing producers when a new participant joins.
 */
export const roomProducers = new Map<
  string,
  Map<string, { userId: string; producer: Producer }>
>();

/** roomId → ActiveSpeakerObserver for dominant speaker detection (UI only) */
export const roomSpeakerObservers = new Map<string, ActiveSpeakerObserver>();

/**
 * roomId → Set of currently active speaker userIds.
 * Updated by the ActiveSpeakerObserver. Used purely for UI indicators —
 * audio consumers are NEVER paused (Opus is cheap, pausing causes clipping).
 */
export const roomActiveSpeakers = new Map<string, Set<string>>();
