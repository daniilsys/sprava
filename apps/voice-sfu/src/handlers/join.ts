import type { VoiceCommand } from "../redis/subscriber.js";
import { publishResponse } from "../redis/publisher.js";
import { getOrCreateRoom } from "../mediasoup/rooms.js";
import {
  userTransports,
  userRooms,
  roomProducers,
} from "../state.js";

const LISTEN_IP = process.env.MEDIASOUP_LISTEN_IP ?? "0.0.0.0";
const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP ?? "127.0.0.1";

export async function handleJoin(cmd: VoiceCommand): Promise<void> {
  const { requestId, roomId, userId } = cmd;
  try {
    const router = await getOrCreateRoom(roomId);

    // Close any stale transport if the user reconnects
    const staleTransport = userTransports.get(userId);
    if (staleTransport) {
      staleTransport.close();
      userTransports.delete(userId);
    }

    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: LISTEN_IP, announcedIp: ANNOUNCED_IP }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    userTransports.set(userId, transport);
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
        transportParams: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        },
        routerRtpCapabilities: router.rtpCapabilities,
        existingProducers,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "JOIN_ERROR";
    await publishResponse(requestId, { ok: false, error });
  }
}
