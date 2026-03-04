import type { Server, Socket } from "socket.io";
import { prisma } from "../config/db.js";
import { redis } from "../config/redis.js";
import { generateId } from "../utils/snowflake.js";
import { toServerResponse, toMemberResponse } from "../modules/servers/servers.mapper.js";
import { toUserResponse } from "../modules/users/users.mapper.js";
import { toDmResponse } from "../modules/dm/dm.mapper.js";
import { toUserSummary } from "../modules/users/users.mapper.js";
import {
  registerVoiceHandlers,
  leaveVoiceRoom,
  getVoiceStatesForRooms,
} from "./voice.handlers.js";

// ─── Presence Redis key ───────────────────────────────────────────────────────

const presenceKey = (serverId: string) => `presence:server:${serverId}`;

// ─── Ready cache ─────────────────────────────────────────────────────────────

const CACHE_TTL = 30; // seconds — user, servers, friendships, dms
const USER_CACHE_TTL = 60;
const readyKey = (section: string, userId: string) => `ready:${section}:${userId}`;

/**
 * Generic cache-aside helper: returns cached JSON if present, otherwise calls
 * `fetch`, stores the result with a TTL, and returns it.
 */
async function getCached<T>(
  key: string,
  ttl: number,
  fetch: () => Promise<T>,
): Promise<T> {
  const raw = await redis.get(key);
  if (raw) return JSON.parse(raw) as T;
  const data = await fetch();
  await redis.set(key, JSON.stringify(data), "EX", ttl);
  return data;
}

/** Invalidate all ready-cache sections for a user (call after profile/server changes). */
export async function invalidateReadyCache(userId: string): Promise<void> {
  await redis.del(
    readyKey("user", userId),
    readyKey("servers", userId),
    readyKey("friendships", userId),
    readyKey("dms", userId),
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function registerSocketHandlers(
  io: Server,
  socket: Socket,
): Promise<void> {
  const userId = socket.data.userId as string;

  const { serverIds, channelIds, dmIds } = await joinUserRooms(socket, userId);

  // Emit the full initial state to the connecting client
  await emitReady(socket, userId, serverIds, channelIds, dmIds);

  // Notify shared servers that this user is now online
  for (const serverId of serverIds) {
    socket.to(`server:${serverId}`).emit("user:presence", {
      userId,
      online: true,
    });
  }

  // ─── Typing indicators (with server-side 5s auto-stop) ───────────────────
  // Key format: "c:{channelId}" or "d:{dmConversationId}"
  const typingTimers = new Map<string, NodeJS.Timeout>();

  function stopTyping(key: string) {
    const existing = typingTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      typingTimers.delete(key);
    }
    const [prefix, id] = [key.slice(0, 1), key.slice(2)];
    if (prefix === "c") {
      socket.to(`channel:${id}`).emit("channel:typing", {
        userId,
        channelId: id,
        typing: false,
      });
    } else {
      socket.to(`dm:${id}`).emit("dm:typing", {
        userId,
        dmConversationId: id,
        typing: false,
      });
    }
  }

  socket.on(
    "typing:start",
    (payload: { channelId?: string; dmConversationId?: string }) => {
      if (payload.channelId) {
        const key = `c:${payload.channelId}`;
        socket.to(`channel:${payload.channelId}`).emit("channel:typing", {
          userId,
          channelId: payload.channelId,
          typing: true,
        });
        // Reset the 5s auto-stop timer on each start
        const existing = typingTimers.get(key);
        if (existing) clearTimeout(existing);
        typingTimers.set(
          key,
          setTimeout(() => stopTyping(key), 5000),
        );
      }
      if (payload.dmConversationId) {
        const key = `d:${payload.dmConversationId}`;
        socket.to(`dm:${payload.dmConversationId}`).emit("dm:typing", {
          userId,
          dmConversationId: payload.dmConversationId,
          typing: true,
        });
        const existing = typingTimers.get(key);
        if (existing) clearTimeout(existing);
        typingTimers.set(
          key,
          setTimeout(() => stopTyping(key), 5000),
        );
      }
    },
  );

  socket.on(
    "typing:stop",
    (payload: { channelId?: string; dmConversationId?: string }) => {
      if (payload.channelId) stopTyping(`c:${payload.channelId}`);
      if (payload.dmConversationId) stopTyping(`d:${payload.dmConversationId}`);
    },
  );

  // ─── Read state ───────────────────────────────────────
  socket.on(
    "channel:read",
    async (payload: { channelId: string; lastReadMessageId: string }) => {
      await prisma.readState.upsert({
        where: { userId_channelId: { userId, channelId: payload.channelId } },
        create: {
          id: generateId(),
          userId,
          channelId: payload.channelId,
          lastReadMessageId: payload.lastReadMessageId,
        },
        update: { lastReadMessageId: payload.lastReadMessageId },
      });
    },
  );

  socket.on(
    "dm:read",
    async (payload: {
      dmConversationId: string;
      lastReadMessageId: string;
    }) => {
      await prisma.readState.upsert({
        where: {
          userId_dmConversationId: {
            userId,
            dmConversationId: payload.dmConversationId,
          },
        },
        create: {
          id: generateId(),
          userId,
          dmConversationId: payload.dmConversationId,
          lastReadMessageId: payload.lastReadMessageId,
        },
        update: { lastReadMessageId: payload.lastReadMessageId },
      });
    },
  );

  // ─── Voice ────────────────────────────────────────────
  registerVoiceHandlers(io, socket);

  // ─── Disconnect ───────────────────────────────────────
  socket.on("disconnect", async () => {
    // Flush any active typing indicators so peers don't get stuck
    for (const key of typingTimers.keys()) {
      stopTyping(key);
    }

    // Auto-leave voice if the user was in a voice room
    const voiceStateRaw = await redis.get(`voice:user:${userId}`);
    if (voiceStateRaw) {
      const { roomId } = JSON.parse(voiceStateRaw) as { roomId: string };
      await leaveVoiceRoom(io, socket, userId, roomId);
    }

    // Only broadcast offline and clean presence if no other active sockets
    const remaining = await io.in(`user:${userId}`).fetchSockets();
    if (remaining.length === 0) {
      // Remove from per-server presence sets
      if (serverIds.length > 0) {
        const pipeline = redis.pipeline();
        for (const serverId of serverIds) {
          pipeline.srem(presenceKey(serverId), userId);
        }
        await pipeline.exec();
      }

      for (const serverId of serverIds) {
        io.to(`server:${serverId}`).emit("user:presence", {
          userId,
          online: false,
        });
      }
    }
  });
}

// ─── emitReady ────────────────────────────────────────────────────────────────

/**
 * Emits a `ready` event with the full initial state.
 *
 * Cache strategy (Redis, TTL-based):
 *   - user (profile + settings)  → TTL 60 s
 *   - servers (channels, roles)  → TTL 30 s — mapped without members (members always live)
 *   - friendships                → TTL 30 s
 *   - dms                        → TTL 30 s
 *
 * Always fresh (already Redis or cheap):
 *   - online members  (Redis presence + one DB batch)
 *   - readStates      (must be accurate for unread counts)
 *   - voiceStates     (already Redis)
 */
async function emitReady(
  socket: Socket,
  userId: string,
  serverIds: string[],
  channelIds: string[],
  dmIds: string[],
): Promise<void> {
  // ── 1. Presence pipeline (Redis, always live) ─────────────────────────────
  const presencePipeline = redis.pipeline();
  for (const id of serverIds) {
    presencePipeline.smembers(presenceKey(id));
  }

  // ── 2. Parallel fetch: cached sections + always-live sections ─────────────
  const [user, cachedServers, friendships, dms, readStates, voiceStates, presenceRaw] =
    await Promise.all([
      // user — TTL 60 s
      getCached(readyKey("user", userId), USER_CACHE_TTL, async () => {
        const u = await prisma.user.findUnique({
          where: { id: userId },
          include: { profile: true, settings: true },
        });
        return u ? toUserResponse(u) : null;
      }),

      // servers mapped without members — TTL 30 s
      // members are always merged from live Redis presence below
      getCached(readyKey("servers", userId), CACHE_TTL, async () => {
        const servers = await prisma.server.findMany({
          where: { id: { in: serverIds } },
          include: {
            channels: {
              orderBy: { position: "asc" },
              include: {
                messages: {
                  where: { deletedAt: null },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { id: true },
                },
              },
            },
            roles: { orderBy: { position: "asc" } },
          },
          orderBy: { createdAt: "asc" },
        });
        // Map without members — roles.permissions BigInt → string via toRoleResponse
        return servers.map((s) => toServerResponse({ ...s, members: [] }));
      }),

      // friendships — TTL 30 s
      getCached(readyKey("friendships", userId), CACHE_TTL, async () => {
        const friendships = await prisma.friendship.findMany({
          where: {
            OR: [{ senderId: userId }, { receiverId: userId }],
            status: { in: ["PENDING", "ACCEPTED"] },
          },
          include: {
            sender: { select: { id: true, username: true, avatar: true } },
            receiver: { select: { id: true, username: true, avatar: true } },
          },
          orderBy: { createdAt: "desc" },
        });
        return friendships.map((f) => ({
          id: f.id,
          status: f.status,
          createdAt: f.createdAt,
          sender: toUserSummary(f.sender),
          receiver: toUserSummary(f.receiver),
        }));
      }),

      // dms — TTL 30 s
      getCached(readyKey("dms", userId), CACHE_TTL, async () => {
        const dms = await prisma.dmConversation.findMany({
          where: { participants: { some: { userId } } },
          include: {
            participants: true,
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true },
            },
          },
          orderBy: { createdAt: "desc" },
        });
        return dms.map(toDmResponse);
      }),

      // readStates — always fresh (critical for unread counts)
      prisma.readState.findMany({
        where: { userId },
        select: {
          channelId: true,
          dmConversationId: true,
          lastReadMessageId: true,
        },
      }),

      // voiceStates — already Redis
      getVoiceStatesForRooms(channelIds, dmIds),

      // presence — always live
      presencePipeline.exec(),
    ]);

  // ── 3. Merge live online members into cached server responses ─────────────
  const onlineByServer = new Map<string, string[]>();
  serverIds.forEach((id, i) => {
    onlineByServer.set(id, (presenceRaw?.[i]?.[1] as string[]) ?? []);
  });

  const allOnlineIds = Array.from(
    new Set(Array.from(onlineByServer.values()).flat()),
  );
  const onlineMemberRecords =
    allOnlineIds.length > 0
      ? await prisma.serverMember.findMany({
          where: { userId: { in: allOnlineIds }, serverId: { in: serverIds } },
          select: { userId: true, serverId: true, joinedAt: true },
        })
      : [];

  const membersByServer = new Map<string, typeof onlineMemberRecords>();
  for (const m of onlineMemberRecords) {
    const arr = membersByServer.get(m.serverId) ?? [];
    arr.push(m);
    membersByServer.set(m.serverId, arr);
  }

  // Inject live members into cached server snapshots
  const servers = cachedServers.map((s) => ({
    ...s,
    members: (membersByServer.get(s.id) ?? []).map(toMemberResponse),
  }));

  socket.emit("ready", {
    user,
    servers,
    friendships,
    dms,
    readStates,
    voiceStates,
  });
}

// ─── joinUserRooms ────────────────────────────────────────────────────────────

/**
 * Joins the socket to all relevant rooms and marks the user online in Redis:
 *   user:{userId}
 *   server:{serverId}   for every server they're in
 *   channel:{channelId} for every channel in those servers
 *   dm:{dmId}           for every DM conversation they participate in
 *
 * Returns server IDs, channel IDs, and DM IDs.
 */
async function joinUserRooms(
  socket: Socket,
  userId: string,
): Promise<{ serverIds: string[]; channelIds: string[]; dmIds: string[] }> {
  socket.join(`user:${userId}`);

  const memberships = await prisma.serverMember.findMany({
    where: { userId },
    select: { serverId: true },
  });
  const serverIds = memberships.map((m) => m.serverId);

  for (const serverId of serverIds) {
    socket.join(`server:${serverId}`);
  }

  const channels = await prisma.channel.findMany({
    where: { serverId: { in: serverIds } },
    select: { id: true },
  });
  const channelIds = channels.map((c) => c.id);
  for (const id of channelIds) {
    socket.join(`channel:${id}`);
  }

  const dms = await prisma.dmParticipant.findMany({
    where: { userId },
    select: { dmConversationId: true },
  });
  const dmIds = dms.map((d) => d.dmConversationId);
  for (const dmConversationId of dmIds) {
    socket.join(`dm:${dmConversationId}`);
  }

  // Mark user as online in per-server presence sets (TTL 24 h as a safety net)
  if (serverIds.length > 0) {
    const pipeline = redis.pipeline();
    for (const serverId of serverIds) {
      pipeline.sadd(presenceKey(serverId), userId);
      pipeline.expire(presenceKey(serverId), 86400);
    }
    await pipeline.exec();
  }

  return { serverIds, channelIds, dmIds };
}
