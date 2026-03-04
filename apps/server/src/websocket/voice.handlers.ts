import type { Server, Socket } from "socket.io";
import { redis } from "../config/redis.js";
import { prisma } from "../config/db.js";
import { Permission } from "@sprava/shared";
import type { SocketVoiceState } from "@sprava/shared";
import { checkPermission } from "../utils/checkPermission.js";
import { rpcToSfu } from "./voice.redis.js";

// ─── Redis key helpers ────────────────────────────────────────────────────────

const userVoiceKey = (userId: string) => `voice:user:${userId}`;
const roomMembersKey = (roomId: string) => `voice:room:${roomId}:members`;

interface StoredVoiceState {
  roomId: string;
  joinedAt: string;
}

// ─── Utility: fetch voice states for a set of rooms ──────────────────────────

/**
 * Returns SocketVoiceState entries for all users currently in the given rooms.
 * Uses a Redis pipeline to avoid N+1 round-trips.
 */
export async function getVoiceStatesForRooms(
  channelIds: string[],
  dmIds: string[],
): Promise<SocketVoiceState[]> {
  const roomIds = [
    ...channelIds.map((id) => `channel:${id}`),
    ...dmIds.map((id) => `dm:${id}`),
  ];
  if (roomIds.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const roomId of roomIds) {
    pipeline.smembers(roomMembersKey(roomId));
  }
  const results = await pipeline.exec();

  const states: SocketVoiceState[] = [];
  for (let i = 0; i < roomIds.length; i++) {
    const members = (results?.[i]?.[1] as string[]) ?? [];
    const roomId = roomIds[i];
    for (const userId of members) {
      states.push({ userId, roomId });
    }
  }
  return states;
}

// ─── Utility: leave a voice room (shared by handler + disconnect) ─────────────

export async function leaveVoiceRoom(
  io: Server,
  socket: Socket,
  userId: string,
  roomId: string,
): Promise<void> {
  // Tell the SFU to clean up (best-effort — SFU might be down)
  try {
    await rpcToSfu("LEAVE", roomId, userId);
  } catch {
    // Ignore — SFU will self-clean via its own disconnect detection
  }

  await Promise.all([
    redis.del(userVoiceKey(userId)),
    redis.srem(roomMembersKey(roomId), userId),
  ]);

  socket.leave(`voice:${roomId}`);

  io.to(`voice:${roomId}`).emit("voice:user_left", { userId, roomId });

  // DM call: notify participants if the call is now empty
  if (roomId.startsWith("dm:")) {
    const dmConversationId = roomId.slice(3);
    const remaining = await redis.scard(roomMembersKey(roomId));
    if (remaining === 0) {
      io.to(`dm:${dmConversationId}`).emit("voice:dm_call_ended", {
        dmConversationId,
      });
    }
  }
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerVoiceHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;

  // ── voice:join ─────────────────────────────────────────────────────────────
  socket.on(
    "voice:join",
    async (payload: { channelId?: string; dmConversationId?: string }) => {
      try {
        let roomId: string;

        if (payload.channelId) {
          const channel = await prisma.channel.findUnique({
            where: { id: payload.channelId },
            select: { serverId: true, type: true },
          });
          if (!channel || channel.type !== "VOICE") {
            socket.emit("voice:error", {
              code: "INVALID_CHANNEL",
              message: "Not a voice channel",
            });
            return;
          }
          await checkPermission(
            userId,
            channel.serverId,
            Permission.JOIN_VOICE,
            payload.channelId,
          );
          roomId = `channel:${payload.channelId}`;
        } else if (payload.dmConversationId) {
          const participant = await prisma.dmParticipant.findUnique({
            where: {
              userId_dmConversationId: {
                userId,
                dmConversationId: payload.dmConversationId,
              },
            },
          });
          if (!participant) {
            socket.emit("voice:error", {
              code: "NOT_PARTICIPANT",
              message: "Not in this DM",
            });
            return;
          }
          roomId = `dm:${payload.dmConversationId}`;
        } else {
          socket.emit("voice:error", {
            code: "INVALID_PAYLOAD",
            message: "Missing channelId or dmConversationId",
          });
          return;
        }

        // Auto-leave previous room if already in one
        const currentRaw = await redis.get(userVoiceKey(userId));
        if (currentRaw) {
          const current = JSON.parse(currentRaw) as StoredVoiceState;
          if (current.roomId !== roomId) {
            await leaveVoiceRoom(io, socket, userId, current.roomId);
          }
        }

        // RPC: JOIN → SFU creates/retrieves Router + WebRtcTransport
        const joinResult = await rpcToSfu<{
          transportParams: unknown;
          routerRtpCapabilities: unknown;
          existingProducers: unknown[];
        }>("JOIN", roomId, userId);

        // Store voice state in Redis (TTL 24 h — cleaned up on leave/disconnect)
        const joinedAt = new Date().toISOString();
        await Promise.all([
          redis.setex(
            userVoiceKey(userId),
            86400,
            JSON.stringify({ roomId, joinedAt } satisfies StoredVoiceState),
          ),
          redis.sadd(roomMembersKey(roomId), userId),
        ]);

        await socket.join(`voice:${roomId}`);

        // Notify others already in the room
        socket.to(`voice:${roomId}`).emit("voice:user_joined", {
          userId,
          roomId,
        });

        // DM call: first joiner triggers an incoming-call notification to other DM participants
        if (roomId.startsWith("dm:")) {
          const dmConversationId = payload.dmConversationId!;
          const roomSize = await redis.scard(roomMembersKey(roomId));
          if (roomSize === 1) {
            socket.to(`dm:${dmConversationId}`).emit("voice:dm_call_incoming", {
              dmConversationId,
              callerId: userId,
            });
          }
        }

        // Build current voice states for the room (excluding self)
        const members = await redis.smembers(roomMembersKey(roomId));
        const voiceStates: SocketVoiceState[] = members
          .filter((id) => id !== userId)
          .map((id) => ({ userId: id, roomId }));

        socket.emit("voice:joined", {
          ...joinResult,
          voiceStates,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        socket.emit("voice:error", { code: "JOIN_FAILED", message });
      }
    },
  );

  // ── voice:leave ────────────────────────────────────────────────────────────
  socket.on("voice:leave", async () => {
    const currentRaw = await redis.get(userVoiceKey(userId));
    if (!currentRaw) return;
    const { roomId } = JSON.parse(currentRaw) as StoredVoiceState;
    await leaveVoiceRoom(io, socket, userId, roomId);
    socket.emit("voice:left");
  });

  // ── voice:connect_transport ────────────────────────────────────────────────
  socket.on(
    "voice:connect_transport",
    async (payload: { transportId: string; dtlsParameters: unknown }) => {
      const currentRaw = await redis.get(userVoiceKey(userId));
      if (!currentRaw) {
        socket.emit("voice:error", {
          code: "NOT_IN_VOICE",
          message: "Not in a voice room",
        });
        return;
      }
      const { roomId } = JSON.parse(currentRaw) as StoredVoiceState;
      try {
        await rpcToSfu("CONNECT_TRANSPORT", roomId, userId, payload);
        socket.emit("voice:transport_ok");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        socket.emit("voice:error", { code: "CONNECT_FAILED", message });
      }
    },
  );

  // ── voice:produce ──────────────────────────────────────────────────────────
  socket.on(
    "voice:produce",
    async (payload: {
      transportId: string;
      kind: string;
      rtpParameters: unknown;
    }) => {
      const currentRaw = await redis.get(userVoiceKey(userId));
      if (!currentRaw) {
        socket.emit("voice:error", {
          code: "NOT_IN_VOICE",
          message: "Not in a voice room",
        });
        return;
      }
      const { roomId } = JSON.parse(currentRaw) as StoredVoiceState;
      try {
        const result = await rpcToSfu<{ producerId: string }>(
          "PRODUCE",
          roomId,
          userId,
          payload,
        );
        socket.emit("voice:produce_ok", { producerId: result.producerId });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        socket.emit("voice:error", { code: "PRODUCE_FAILED", message });
      }
    },
  );

  // ── voice:consume_request ──────────────────────────────────────────────────
  socket.on(
    "voice:consume_request",
    async (payload: { producerId: string; rtpCapabilities: unknown }) => {
      const currentRaw = await redis.get(userVoiceKey(userId));
      if (!currentRaw) {
        socket.emit("voice:error", {
          code: "NOT_IN_VOICE",
          message: "Not in a voice room",
        });
        return;
      }
      const { roomId } = JSON.parse(currentRaw) as StoredVoiceState;
      try {
        const result = await rpcToSfu<{
          consumerId: string;
          producerId: string;
          kind: string;
          rtpParameters: unknown;
        }>("CONSUME", roomId, userId, payload);
        socket.emit("voice:consumer_ready", result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        socket.emit("voice:error", { code: "CONSUME_FAILED", message });
      }
    },
  );
}
