import type { Server, Socket } from "socket.io";
import { prisma } from "../config/db.js";
import { redis } from "../config/redis.js";
import { generateId } from "../utils/snowflake.js";
import { toServerResponse, toMemberResponse } from "../modules/servers/servers.mapper.js";
import { toUserResponse } from "../modules/users/users.mapper.js";
import { toDmResponse } from "../modules/dm/dm.mapper.js";
import { toUserSummary } from "../modules/users/users.mapper.js";
import { toChannelRuleResponse } from "../modules/channels/channels.mapper.js";
import {
  registerVoiceHandlers,
  leaveVoiceRoom,
  getVoiceStatesForRooms,
} from "./voice.handlers.js";

// ─── Redis keys ──────────────────────────────────────────────────────────────

const presenceKey = (serverId: string) => `presence:server:${serverId}`;
const statusKey = (userId: string) => `user:status:${userId}`;
/** Reverse index: who wants presence updates about `targetUserId`? */
const presenceSubKey = (targetUserId: string) => `presence:sub:${targetUserId}`;

// ─── Ready cache ─────────────────────────────────────────────────────────────

const CACHE_TTL = 30;
const USER_CACHE_TTL = 60;
const readyKey = (section: string, userId: string) => `ready:${section}:${userId}`;

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

/** Invalidate all ready-cache sections for a user. */
export async function invalidateReadyCache(userId: string): Promise<void> {
  await redis.del(
    readyKey("user", userId),
    readyKey("servers", userId),
    readyKey("friendships", userId),
    readyKey("dms", userId),
  );
}

// ─── P5: Rate limiter ────────────────────────────────────────────────────────

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(maxCount: number, windowMs: number) {
  const buckets = new Map<string, RateLimitBucket>();

  // Periodic cleanup to avoid memory leaks (every 60s)
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(key);
    }
  }, 60_000);
  interval.unref(); // don't keep the process alive

  return function check(socketId: string): boolean {
    const now = Date.now();
    const entry = buckets.get(socketId);
    if (!entry || now >= entry.resetAt) {
      buckets.set(socketId, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= maxCount) return false;
    entry.count++;
    return true;
  };
}

const typingLimiter = createRateLimiter(5, 5000);
const statusLimiter = createRateLimiter(2, 5000);
const presenceSubLimiter = createRateLimiter(10, 5000);
const channelFocusLimiter = createRateLimiter(20, 5000);
const memberRequestLimiter = createRateLimiter(5, 5000);

// ─── Status helpers ──────────────────────────────────────────────────────────

async function getUserStatus(userId: string): Promise<{ status: string; statusMessage: string }> {
  const cached = await redis.get(statusKey(userId));
  if (cached) return JSON.parse(cached) as { status: string; statusMessage: string };

  const row = await prisma.userStatus.findUnique({ where: { userId } });
  const result = row
    ? { status: row.status, statusMessage: row.statusMessage }
    : { status: "offline", statusMessage: "" };

  await redis.set(statusKey(userId), JSON.stringify(result), "EX", 300);
  return result;
}

async function getUserStatuses(userIds: string[]): Promise<Record<string, { status: string; statusMessage: string }>> {
  if (userIds.length === 0) return {};

  const pipeline = redis.pipeline();
  for (const id of userIds) pipeline.get(statusKey(id));
  const results = await pipeline.exec();

  const cached = new Map<string, { status: string; statusMessage: string }>();
  const uncachedIds: string[] = [];

  for (let i = 0; i < userIds.length; i++) {
    const raw = results?.[i]?.[1] as string | null;
    if (raw) {
      cached.set(userIds[i], JSON.parse(raw));
    } else {
      uncachedIds.push(userIds[i]);
    }
  }

  if (uncachedIds.length > 0) {
    const rows = await prisma.userStatus.findMany({ where: { userId: { in: uncachedIds } } });
    const rowMap = new Map(rows.map((r) => [r.userId, r]));
    const cachePipeline = redis.pipeline();
    for (const id of uncachedIds) {
      const row = rowMap.get(id);
      const val = row
        ? { status: row.status, statusMessage: row.statusMessage }
        : { status: "offline", statusMessage: "" };
      cached.set(id, val);
      cachePipeline.set(statusKey(id), JSON.stringify(val), "EX", 300);
    }
    await cachePipeline.exec();
  }

  const out: Record<string, { status: string; statusMessage: string }> = {};
  for (const [id, val] of cached) out[id] = val;
  return out;
}

// ─── P0: Subscription-based presence broadcast ──────────────────────────────

const MAX_PRESENCE_SUBSCRIPTIONS = 2000; // max subscriptions per user

/**
 * Broadcasts a presence update ONLY to users who subscribed to this userId.
 * Uses Redis SET `presence:sub:{userId}` as the reverse index.
 */
async function broadcastPresenceToSubscribers(
  io: Server,
  userId: string,
  status: string,
  statusMessage: string,
): Promise<void> {
  const subscriberIds = await redis.smembers(presenceSubKey(userId));
  if (subscriberIds.length === 0) return;

  const payload = { userId, status, statusMessage };

  // Emit to each subscriber's personal room (batched — Socket.io handles dedup)
  const rooms = subscriberIds.map((id) => `user:${id}`);

  // Socket.io .to() accepts a single room or array
  io.to(rooms).emit("user:presence", payload);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function registerSocketHandlers(
  io: Server,
  socket: Socket,
): Promise<void> {
  const userId = socket.data.userId as string;

  // Track this user's outbound presence subscriptions for cleanup on disconnect
  const presenceSubscriptions = new Set<string>();
  socket.data.presenceSubscriptions = presenceSubscriptions;

  const { serverIds, channelIds, dmIds } = await joinUserRooms(socket, userId);

  // Fetch username once for typing indicators
  const userRow = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  const username = userRow?.username ?? "Someone";

  // Restore user's status on connect:
  // - If they had an explicit non-offline status (online/idle/dnd), restore it
  // - If they had "offline" (invisible) or no row, default to "online"
  // This ensures connected users always appear online unless they explicitly chose invisible
  const storedStatus = await getUserStatus(userId);
  const connectStatus = storedStatus.status === "offline"
    ? { status: "online", statusMessage: storedStatus.statusMessage }
    : storedStatus;

  // Persist the restored status to Redis so all presence checks see it
  await redis.set(statusKey(userId), JSON.stringify(connectStatus), "EX", 300);

  // Emit the full initial state to the connecting client
  await emitReady(io, socket, userId, serverIds, channelIds, dmIds);

  // Notify presence subscribers that this user is now online
  await broadcastPresenceToSubscribers(io, userId, connectStatus.status, connectStatus.statusMessage);

  // ─── P0: Presence subscriptions ─────────────────────────────────────────

  socket.on(
    "presence:subscribe",
    async (payload: { userIds: string[] }) => {
      if (!presenceSubLimiter(socket.id)) return;
      if (!Array.isArray(payload?.userIds)) return;

      // Limit per call and total
      const ids = payload.userIds.slice(0, 200);
      const remaining = MAX_PRESENCE_SUBSCRIPTIONS - presenceSubscriptions.size;
      const toAdd = ids.filter((id) => !presenceSubscriptions.has(id)).slice(0, remaining);
      if (toAdd.length === 0) return;

      // Register in Redis reverse index
      const pipeline = redis.pipeline();
      for (const targetId of toAdd) {
        pipeline.sadd(presenceSubKey(targetId), userId);
        pipeline.expire(presenceSubKey(targetId), 86400);
        presenceSubscriptions.add(targetId);
      }
      await pipeline.exec();

      // Immediately send current presence for subscribed users
      // Check which are online via presence:server:* sets
      const onlineCheck = redis.pipeline();
      for (const targetId of toAdd) {
        // Check if user has any active socket
        onlineCheck.exists(`user:status:${targetId}`);
      }
      const onlineResults = await onlineCheck.exec();

      // Actually check if they have active sockets
      const onlineIds: string[] = [];
      const offlineIds: string[] = [];
      for (let i = 0; i < toAdd.length; i++) {
        // A status cache entry doesn't guarantee online (it has 5min TTL).
        // Check via socket room instead.
        const sockets = await io.in(`user:${toAdd[i]}`).fetchSockets();
        if (sockets.length > 0) {
          onlineIds.push(toAdd[i]);
        } else {
          offlineIds.push(toAdd[i]);
        }
      }

      const states: Record<string, { status: string; statusMessage: string }> = {};

      if (onlineIds.length > 0) {
        const statuses = await getUserStatuses(onlineIds);
        Object.assign(states, statuses);
      }
      for (const id of offlineIds) {
        states[id] = { status: "offline", statusMessage: "" };
      }

      socket.emit("presence:state", { states });
    },
  );

  socket.on(
    "presence:unsubscribe",
    async (payload: { userIds: string[] }) => {
      if (!Array.isArray(payload?.userIds)) return;

      const pipeline = redis.pipeline();
      for (const targetId of payload.userIds) {
        if (presenceSubscriptions.has(targetId)) {
          pipeline.srem(presenceSubKey(targetId), userId);
          presenceSubscriptions.delete(targetId);
        }
      }
      await pipeline.exec();
    },
  );

  // ─── User status ─────────────────────────────────────────────────────────
  let lastPresenceBroadcast = 0;
  let pendingPresence: { status: string; statusMessage: string } | null = null;
  let presenceTimer: NodeJS.Timeout | null = null;

  function broadcastPresence(status: string, msg: string) {
    broadcastPresenceToSubscribers(io, userId, status, msg);
    socket.emit("user:presence", { userId, status, statusMessage: msg });
    lastPresenceBroadcast = Date.now();
    pendingPresence = null;
  }

  socket.on(
    "user:set_status",
    async ({ status, statusMessage }: { status: string; statusMessage?: string }) => {
      if (!statusLimiter(socket.id)) return;
      const validStatuses = ["online", "idle", "dnd", "offline"];
      if (!validStatuses.includes(status)) return;
      const msg = (statusMessage || "").slice(0, 128);

      // Persist to DB + cache in Redis
      await prisma.userStatus.upsert({
        where: { userId },
        create: { userId, status, statusMessage: msg },
        update: { status, statusMessage: msg },
      });
      await redis.set(statusKey(userId), JSON.stringify({ status, statusMessage: msg }), "EX", 300);

      // Throttle broadcasts to max 1 per 5s
      const now = Date.now();
      const elapsed = now - lastPresenceBroadcast;
      if (elapsed >= 5000) {
        broadcastPresence(status, msg);
      } else {
        pendingPresence = { status, statusMessage: msg };
        if (!presenceTimer) {
          presenceTimer = setTimeout(() => {
            presenceTimer = null;
            if (pendingPresence) {
              broadcastPresence(pendingPresence.status, pendingPresence.statusMessage);
            }
          }, 5000 - elapsed);
        }
      }
    },
  );

  // ─── P2: Channel focus (selective channel room joins) ───────────────────

  socket.on(
    "channel:focus",
    async (payload: { channelId: string | null }) => {
      if (!channelFocusLimiter(socket.id)) return;

      // Leave previous channel room
      const prevChannelId = socket.data.focusedChannelId as string | undefined;
      if (prevChannelId) {
        socket.leave(`channel:${prevChannelId}`);
      }

      if (payload.channelId) {
        // Validate that channel exists and user is a member of its server
        const channel = await prisma.channel.findUnique({
          where: { id: payload.channelId },
          select: { serverId: true },
        });
        if (channel && serverIds.includes(channel.serverId)) {
          socket.join(`channel:${payload.channelId}`);
          socket.data.focusedChannelId = payload.channelId;
        }
      } else {
        socket.data.focusedChannelId = undefined;
      }
    },
  );

  // ─── P1: Lazy member loading ────────────────────────────────────────────

  socket.on(
    "server:request_members",
    async (payload: { serverId: string; cursor?: string }) => {
      if (!memberRequestLimiter(socket.id)) return;
      if (!payload?.serverId || !serverIds.includes(payload.serverId)) return;

      const CHUNK_SIZE = 50;
      const members = await prisma.serverMember.findMany({
        where: {
          serverId: payload.serverId,
          ...(payload.cursor ? { userId: { gt: payload.cursor } } : {}),
        },
        orderBy: { userId: "asc" },
        take: CHUNK_SIZE + 1,
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
      });

      const hasMore = members.length > CHUNK_SIZE;
      const chunk = hasMore ? members.slice(0, CHUNK_SIZE) : members;

      // Fetch role assignments for these members
      const memberUserIds = chunk.map((m) => m.userId);
      const roleAssignments = await prisma.memberRole.findMany({
        where: {
          memberId: { in: memberUserIds },
          role: { serverId: payload.serverId },
        },
        select: { memberId: true, roleId: true },
      });
      const rolesByUser = new Map<string, string[]>();
      for (const ra of roleAssignments) {
        const arr = rolesByUser.get(ra.memberId) ?? [];
        arr.push(ra.roleId);
        rolesByUser.set(ra.memberId, arr);
      }

      socket.emit("server:members_chunk", {
        serverId: payload.serverId,
        members: chunk.map((m) => ({
          ...toMemberResponse(m),
          roleIds: rolesByUser.get(m.userId) ?? [],
        })),
        cursor: hasMore ? chunk[chunk.length - 1].userId : null,
      });
    },
  );

  // ─── Typing indicators (with server-side 5s auto-stop) ───────────────────
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
        username,
        channelId: id,
        typing: false,
      });
    } else {
      socket.to(`dm:${id}`).emit("dm:typing", {
        userId,
        username,
        dmConversationId: id,
        typing: false,
      });
    }
  }

  socket.on(
    "typing:start",
    (payload: { channelId?: string; dmConversationId?: string }) => {
      if (!typingLimiter(socket.id)) return;
      if (payload.channelId) {
        const key = `c:${payload.channelId}`;
        socket.to(`channel:${payload.channelId}`).emit("channel:typing", {
          userId,
          username,
          channelId: payload.channelId,
          typing: true,
        });
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
          username,
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
    // Clean up presence throttle timer
    if (presenceTimer) {
      clearTimeout(presenceTimer);
      presenceTimer = null;
    }

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
      // Remove from per-server presence sets + clear cached status
      const pipeline = redis.pipeline();
      for (const serverId of serverIds) {
        pipeline.srem(presenceKey(serverId), userId);
      }
      pipeline.del(statusKey(userId));
      await pipeline.exec();

      // P0: Broadcast offline to subscribers (instead of all server rooms)
      await broadcastPresenceToSubscribers(io, userId, "offline", "");
    }

    // P0: Clean up this user's outbound presence subscriptions
    if (presenceSubscriptions.size > 0) {
      // Only clean if no other sockets for this user
      const otherSockets = await io.in(`user:${userId}`).fetchSockets();
      if (otherSockets.length === 0) {
        const cleanupPipeline = redis.pipeline();
        for (const targetId of presenceSubscriptions) {
          cleanupPipeline.srem(presenceSubKey(targetId), userId);
        }
        await cleanupPipeline.exec();
      }
    }
  });
}

// ─── emitReady ────────────────────────────────────────────────────────────────

/**
 * Emits a `ready` event with the initial state.
 *
 * Optimized vs original:
 *   - No members in server objects (P1: lazy member loading)
 *   - Minimal presenceStates (P0: only friends + DM participants)
 *   - No channel room joins (P2: selective via channel:focus)
 */
async function emitReady(
  io: Server,
  socket: Socket,
  userId: string,
  serverIds: string[],
  channelIds: string[],
  dmIds: string[],
): Promise<void> {
  // Parallel fetch: cached sections + always-live sections
  const [user, cachedServers, friendships, dms, readStates, voiceStates, memberRoleRows, channelRuleRows] =
    await Promise.all([
      // user — TTL 60 s
      getCached(readyKey("user", userId), USER_CACHE_TTL, async () => {
        const u = await prisma.user.findUnique({
          where: { id: userId },
          include: { profile: true, settings: true },
        });
        return u ? toUserResponse(u) : null;
      }),

      // servers — TTL 30 s (no members, no live presence merge)
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
            participants: {
              include: {
                user: { select: { id: true, username: true, avatar: true } },
              },
            },
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

      // readStates — always fresh
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

      // memberRoles — user's roles across all servers
      prisma.memberRole.findMany({
        where: { memberId: userId, role: { serverId: { in: serverIds } } },
        select: { roleId: true, role: { select: { serverId: true } } },
      }),

      // channelRules — permission overrides
      channelIds.length > 0
        ? prisma.channelRule.findMany({
            where: { channelId: { in: channelIds } },
          })
        : [],
    ]);

  // P0: Only compute presence for friends + DM participants (small set)
  const presenceUserIds = new Set<string>();

  // Friends
  for (const f of friendships) {
    const friendId = f.sender.id === userId ? f.receiver.id : f.sender.id;
    if (f.status === "ACCEPTED") presenceUserIds.add(friendId);
  }

  // DM participants
  for (const dm of dms) {
    if (dm.participants) {
      for (const p of dm.participants) {
        if (p.userId !== userId) presenceUserIds.add(p.userId);
      }
    }
  }

  // Check which are online + get their statuses
  const presenceStates: Record<string, { status: string; statusMessage: string }> = {};

  if (presenceUserIds.size > 0) {
    const idsToCheck = Array.from(presenceUserIds);
    // Batch check online status via socket rooms
    const socketChecks = await Promise.all(
      idsToCheck.map((pId) => io.in(`user:${pId}`).fetchSockets()),
    );

    const onlineIds: string[] = [];
    for (let i = 0; i < idsToCheck.length; i++) {
      if (socketChecks[i].length > 0) {
        onlineIds.push(idsToCheck[i]);
      } else {
        presenceStates[idsToCheck[i]] = { status: "offline", statusMessage: "" };
      }
    }

    if (onlineIds.length > 0) {
      const statuses = await getUserStatuses(onlineIds);
      Object.assign(presenceStates, statuses);
    }
  }

  // Include the user's own stored status so the client can restore it on reconnect
  const ownStatus = await getUserStatus(userId);
  presenceStates[userId] = ownStatus;

  // P1: No members in server objects — client fetches lazily
  const servers = cachedServers.map((s) => ({
    ...s,
    members: [],
  }));

  // Build memberRoleIds per server
  const memberRoleIds: Record<string, string[]> = {};
  for (const mr of memberRoleRows) {
    const sid = mr.role.serverId;
    (memberRoleIds[sid] ??= []).push(mr.roleId);
  }

  socket.emit("ready", {
    user,
    servers,
    friendships,
    dms,
    readStates,
    voiceStates,
    memberRoleIds,
    presenceStates,
    channelRules: channelRuleRows.map(toChannelRuleResponse),
  });
}

// ─── joinUserRooms ────────────────────────────────────────────────────────────

/**
 * Joins the socket to relevant rooms and marks user online in Redis.
 *
 * P2 optimization: does NOT join channel rooms on connect.
 * Channels are joined on-demand via `channel:focus` events.
 * Server rooms are joined for server-wide events (channel CRUD, roles, members).
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

  // P2: Fetch channel IDs for voice states and channel rules, but DON'T join channel rooms.
  const channels = await prisma.channel.findMany({
    where: { serverId: { in: serverIds } },
    select: { id: true },
  });
  const channelIds = channels.map((c) => c.id);
  // NOTE: No socket.join(`channel:${id}`) — channels joined on focus

  const dms = await prisma.dmParticipant.findMany({
    where: { userId },
    select: { dmConversationId: true },
  });
  const dmIds = dms.map((d) => d.dmConversationId);
  for (const dmConversationId of dmIds) {
    socket.join(`dm:${dmConversationId}`);
  }

  // Mark user as online in per-server presence sets (TTL 24 h safety net)
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
