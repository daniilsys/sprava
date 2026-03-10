import type { VoiceCommand } from "../redis/subscriber.js";
import { publishResponse } from "../redis/publisher.js";
import { getOrCreateRoom } from "../mediasoup/rooms.js";
import {
  transports,
  userTransportIds,
  userRooms,
  roomProducers,
} from "../state.js";

const LISTEN_IP = process.env.MEDIASOUP_LISTEN_IP ?? "0.0.0.0";
const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP ?? "127.0.0.1";

/** Initial outgoing bitrate for BWE (Bandwidth Estimation). */
const INITIAL_AVAILABLE_OUTGOING_BITRATE = 600_000; // 600 kbps

function transportParams(t: { id: string; iceParameters: unknown; iceCandidates: unknown; dtlsParameters: unknown }) {
  return {
    id: t.id,
    iceParameters: t.iceParameters,
    iceCandidates: t.iceCandidates,
    dtlsParameters: t.dtlsParameters,
  };
}

export async function handleJoin(cmd: VoiceCommand): Promise<void> {
  const { requestId, roomId, userId } = cmd;
  try {
    const router = await getOrCreateRoom(roomId);

    // Close any stale transports if the user reconnects
    const staleIds = userTransportIds.get(userId) ?? [];
    for (const id of staleIds) {
      const t = transports.get(id);
      if (t) { t.close(); transports.delete(id); }
    }
    userTransportIds.delete(userId);

    const webRtcOpts = {
      listenIps: [{ ip: LISTEN_IP, announcedIp: ANNOUNCED_IP }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: INITIAL_AVAILABLE_OUTGOING_BITRATE,
      // ICE consent timeout — drop unresponsive connections faster
      iceConsentTimeout: 20,
    };

    const sendTransport = await router.createWebRtcTransport(webRtcOpts);
    const recvTransport = await router.createWebRtcTransport(webRtcOpts);

    // Cap incoming bitrate on the send transport (what the client sends us)
    // 1.5 Mbps is enough for Opus audio + 720p video
    await sendTransport.setMaxIncomingBitrate(1_500_000);

    transports.set(sendTransport.id, sendTransport);
    transports.set(recvTransport.id, recvTransport);
    userTransportIds.set(userId, [sendTransport.id, recvTransport.id]);
    userRooms.set(userId, roomId);

    // Collect existing producers in the room (for the joining client to consume)
    const producersMap = roomProducers.get(roomId) ?? new Map();
    const existingProducers = Array.from(producersMap.entries()).map(
      ([producerId, { userId: producerUserId, producer }]) => ({
        producerId,
        userId: producerUserId,
        kind: producer.kind,
      }),
    );

    await publishResponse(requestId, {
      ok: true,
      payload: {
        sendTransportOptions: transportParams(sendTransport),
        recvTransportOptions: transportParams(recvTransport),
        routerRtpCapabilities: router.rtpCapabilities,
        existingProducers,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "JOIN_ERROR";
    await publishResponse(requestId, { ok: false, error });
  }
}
