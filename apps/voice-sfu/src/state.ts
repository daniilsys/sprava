import type {
  WebRtcTransport,
  Producer,
  Consumer,
} from "mediasoup/types";

// Per-user resources (one transport, N producers, N consumers per user)
export const userTransports = new Map<string, WebRtcTransport>();
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
