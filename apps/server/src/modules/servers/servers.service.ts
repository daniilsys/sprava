import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { generateId } from "../../utils/snowflake.js";
import { generateInviteCode } from "../../utils/inviteCode.js";
import {
  CreateServerDto,
  UpdateServerDto,
  PaginationQuery,
} from "./servers.schema.js";
import { getIO } from "../../websocket/index.js";
import {
  toServerResponse,
  toMemberResponse,
  toServerBanResponse,
} from "./servers.mapper.js";
import { toChannelResponse, toChannelRuleResponse } from "../channels/channels.mapper.js";
import {
  checkPermission,
  checkRoleHierarchy,
} from "../../utils/checkPermission.js";
import { Permission, PermissionUtils, DEFAULT_WORLD_PERMISSIONS } from "@sprava/shared";
import { redis } from "../../config/redis.js";
import { invalidateReadyCache } from "../../websocket/socket.handlers.js";
import { createAuditEntry } from "../audit/audit.service.js";

/**
 * Clean up Redis caches when a user leaves/is removed from a server:
 * - Remove from presence:server:{serverId} SET
 * - Invalidate ready cache (servers list is stale)
 * - Remove presence subscriptions for members of that server
 *   (this user no longer needs updates from them)
 */
async function cleanupServerCaches(serverId: string, userId: string): Promise<void> {
  const pipeline = redis.pipeline();

  // Remove from server presence SET
  pipeline.srem(`presence:server:${serverId}`, userId);

  // Invalidate ready cache so next connect doesn't include this server
  await invalidateReadyCache(userId);

  await pipeline.exec();
}

export class ServersService {
  private async requireServer(serverId: string) {
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server)
      throw new AppError("Server not found", 404, "SERVER_NOT_FOUND");
    return server;
  }

  private async requireMember(serverId: string, userId: string) {
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member)
      throw new AppError("Server not found", 404, "SERVER_NOT_FOUND");
    return member;
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = generateInviteCode();
      const exists = await prisma.server.findUnique({ where: { inviteCode: code } });
      if (!exists) return code;
    }
    throw new AppError("Failed to generate unique invite code", 500, "INVITE_CODE_GENERATION_FAILED");
  }

  async create(dto: CreateServerDto, ownerId: string) {
    const inviteCode = await this.generateUniqueInviteCode();
    return prisma.$transaction(async (tx) => {
      const server = await tx.server.create({
        data: {
          id: generateId(),
          name: dto.name,
          icon: dto.icon,
          description: dto.description,
          ownerId,
          inviteCode,
        },
      });

      await tx.serverMember.create({
        data: { serverId: server.id, userId: ownerId },
      });

      await tx.role.create({
        data: {
          id: generateId(),
          serverId: server.id,
          name: "@world",
          permissions: DEFAULT_WORLD_PERMISSIONS,
          position: 0,
          isWorld: true,
        },
      });

      await tx.channel.createMany({
        data: [
          {
            id: generateId(),
            serverId: server.id,
            name: "chat",
            type: "TEXT",
          },
          {
            id: generateId(),
            serverId: server.id,
            name: "Voice Channel",
            type: "VOICE",
            position: 1,
          },
        ],
      });

      const full = await tx.server.findUnique({
        where: { id: server.id },
        include: { members: true, channels: true, roles: true },
      });
      return full ? toServerResponse(full) : null;
    });
  }

  async update(serverId: string, dto: UpdateServerDto, userId: string) {
    await this.requireServer(serverId);
    await checkPermission(userId, serverId, Permission.CONFIGURE_SERVER);

    const updated = await prisma.server.update({
      where: { id: serverId },
      data: { name: dto.name, icon: dto.icon, description: dto.description },
    });

    await createAuditEntry(serverId, userId, "SERVER_UPDATE", "Server", serverId, {
      name: dto.name,
      icon: dto.icon,
      description: dto.description,
    });

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("server:updated", {
        server: {
          id: updated.id,
          name: updated.name,
          icon: updated.icon,
          description: updated.description,
        },
      });
    }

    return toServerResponse(updated);
  }

  async delete(serverId: string, userId: string) {
    const server = await this.requireServer(serverId);
    if (server.ownerId !== userId)
      throw new AppError(
        "Only the owner can delete the server",
        403,
        "NOT_OWNER",
      );

    // Fetch members before delete for cache cleanup
    const members = await prisma.serverMember.findMany({
      where: { serverId },
      select: { userId: true },
    });

    // Emit BEFORE delete — rooms are emptied after delete
    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("server:deleted", { serverId });
    }

    await prisma.server.delete({ where: { id: serverId } });

    // Clean up Redis caches for all former members
    const pipeline = redis.pipeline();
    pipeline.del(`presence:server:${serverId}`);
    await pipeline.exec();
    // Invalidate ready cache for all members so the deleted server is gone
    await Promise.all(members.map((m) => invalidateReadyCache(m.userId)));
  }

  async getById(
    serverId: string,
    userId: string,
    includeChannels = false,
    includeRoles = false,
    includeMembers = false,
  ) {
    await this.requireMember(serverId, userId);
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        channels: includeChannels,
        roles: includeRoles,
        members: includeMembers,
      },
    });
    if (!server)
      throw new AppError("Server not found", 404, "SERVER_NOT_FOUND");
    return toServerResponse(server);
  }

  async getMembers(
    serverId: string,
    userId: string,
    { cursor, limit: rawLimit = 50 }: Partial<PaginationQuery> = {},
  ) {
    const limit = Number(rawLimit);
    await this.requireMember(serverId, userId);
    const members = await prisma.serverMember.findMany({
      where: {
        serverId,
        ...(cursor ? { joinedAt: { gt: new Date(cursor) } } : {}),
      },
      orderBy: { joinedAt: "asc" },
      take: limit + 1,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            memberRoles: {
              where: { role: { serverId } },
              select: { roleId: true },
            },
          },
        },
      },
    });
    const hasMore = members.length > limit;
    if (hasMore) members.pop();
    return {
      data: members.map(toMemberResponse),
      cursor: hasMore
        ? members[members.length - 1].joinedAt.toISOString()
        : null,
    };
  }

  async getMember(serverId: string, userId: string, memberId: string) {
    await this.requireMember(serverId, userId);
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: memberId, serverId } },
    });
    if (!member)
      throw new AppError("Member not found", 404, "MEMBER_NOT_FOUND");
    return toMemberResponse(member);
  }

  async getChannels(serverId: string, userId: string) {
    await this.requireMember(serverId, userId);
    const channels = await prisma.channel.findMany({
      where: { serverId },
      orderBy: { position: "asc" },
    });
    return channels.map(toChannelResponse);
  }

  async joinByInviteCode(inviteCode: string, userId: string) {
    const server = await prisma.server.findUnique({ where: { inviteCode } });
    if (!server)
      throw new AppError("Invalid invite code", 400, "INVALID_INVITE_CODE");

    const existing = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId: server.id } },
    });
    if (existing)
      throw new AppError(
        "You are already a member of this server",
        400,
        "ALREADY_MEMBER",
      );

    await prisma.serverMember.create({ data: { serverId: server.id, userId } });

    // Fetch full server data + channel rules + new member in parallel (single round-trip)
    const [full, channelRuleRows, newMember] = await Promise.all([
      prisma.server.findUnique({
        where: { id: server.id },
        include: {
          channels: { orderBy: { position: "asc" } },
          roles: { orderBy: { position: "asc" } },
        },
      }),
      prisma.channelRule.findMany({
        where: { channel: { serverId: server.id } },
      }),
      prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId: server.id } },
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
      }),
    ]);

    const io = getIO();
    if (io) {
      // Use channels from the full query — no extra fetch needed
      io.in(`user:${userId}`).socketsJoin(`server:${server.id}`);
      if (full?.channels) {
        for (const ch of full.channels) {
          io.in(`user:${userId}`).socketsJoin(`channel:${ch.id}`);
        }
      }

      io.to(`server:${server.id}`).emit("server:member_join", {
        serverId: server.id,
        userId,
        member: newMember ? toMemberResponse(newMember) : undefined,
      });
    }

    const response = full ? toServerResponse(full) : toServerResponse(server);
    return {
      ...response,
      channelRules: channelRuleRows.map(toChannelRuleResponse),
    };
  }

  async kickMember(serverId: string, targetUserId: string, userId: string) {
    await checkPermission(userId, serverId, Permission.KICK);
    await checkRoleHierarchy(userId, targetUserId, serverId);
    await prisma.$transaction([
      prisma.memberRole.deleteMany({
        where: { memberId: targetUserId, role: { serverId } },
      }),
      prisma.serverMember.delete({
        where: { userId_serverId: { userId: targetUserId, serverId } },
      }),
    ]);

    await createAuditEntry(serverId, userId, "MEMBER_KICK", "User", targetUserId);

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("server:member_leave", {
        serverId,
        userId: targetUserId,
      });
      io.in(`user:${targetUserId}`).socketsLeave(`server:${serverId}`);
      const channels = await prisma.channel.findMany({
        where: { serverId },
        select: { id: true },
      });
      for (const { id } of channels) {
        io.in(`user:${targetUserId}`).socketsLeave(`channel:${id}`);
      }
    }
    await cleanupServerCaches(serverId, targetUserId);
  }

  async banMember(
    serverId: string,
    targetUserId: string,
    userId: string,
    reason?: string,
  ) {
    await checkPermission(userId, serverId, Permission.BAN);
    await checkRoleHierarchy(userId, targetUserId, serverId);

    await prisma.$transaction(async (tx) => {
      await tx.memberRole.deleteMany({
        where: { memberId: targetUserId, role: { serverId } },
      });
      await tx.serverBan.create({
        data: { serverId, userId: targetUserId, reason },
      });
      await tx.serverMember.delete({
        where: { userId_serverId: { userId: targetUserId, serverId } },
      });
    });

    await createAuditEntry(serverId, userId, "MEMBER_BAN", "User", targetUserId, {
      reason,
    });

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("server:member_leave", {
        serverId,
        userId: targetUserId,
      });
      io.in(`user:${targetUserId}`).socketsLeave(`server:${serverId}`);
      const channels = await prisma.channel.findMany({
        where: { serverId },
        select: { id: true },
      });
      for (const { id } of channels) {
        io.in(`user:${targetUserId}`).socketsLeave(`channel:${id}`);
      }
    }
    await cleanupServerCaches(serverId, targetUserId);
  }

  async unbanMember(serverId: string, targetUserId: string, userId: string) {
    await checkPermission(userId, serverId, Permission.UNBAN);
    await prisma.serverBan.delete({
      where: { userId_serverId: { userId: targetUserId, serverId } },
    });

    await createAuditEntry(serverId, userId, "MEMBER_UNBAN", "User", targetUserId);
  }

  async leave(serverId: string, userId: string) {
    const server = await this.requireServer(serverId);
    if (server.ownerId === userId)
      throw new AppError(
        "Owners cannot leave their own server",
        400,
        "OWNER_CANNOT_LEAVE",
      );

    await this.requireMember(serverId, userId);
    await prisma.$transaction([
      prisma.memberRole.deleteMany({
        where: { memberId: userId, role: { serverId } },
      }),
      prisma.serverMember.delete({
        where: { userId_serverId: { userId, serverId } },
      }),
    ]);

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("server:member_leave", {
        serverId,
        userId,
      });
      io.in(`user:${userId}`).socketsLeave(`server:${serverId}`);
      const channels = await prisma.channel.findMany({
        where: { serverId },
        select: { id: true },
      });
      for (const { id } of channels) {
        io.in(`user:${userId}`).socketsLeave(`channel:${id}`);
      }
    }
    await cleanupServerCaches(serverId, userId);
  }

  async getBans(
    serverId: string,
    userId: string,
    { cursor, limit: rawLimit = 50 }: Partial<PaginationQuery> = {},
  ) {
    const limit = Number(rawLimit);
    await checkPermission(userId, serverId, Permission.BAN | Permission.UNBAN);
    const bans = await prisma.serverBan.findMany({
      where: {
        serverId,
        ...(cursor ? { bannedAt: { gt: new Date(cursor) } } : {}),
      },
      include: {
        user: { select: { username: true, avatar: true } },
      },
      orderBy: { bannedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = bans.length > limit;
    if (hasMore) bans.pop();
    return {
      data: bans.map(toServerBanResponse),
      cursor: hasMore ? bans[bans.length - 1].bannedAt.toISOString() : null,
    };
  }

  async preview(code: string) {
    const server = await prisma.server.findUnique({
      where: { inviteCode: code },
      include: { _count: { select: { members: true } } },
    });
    if (!server)
      throw new AppError("Server not found", 404, "SERVER_NOT_FOUND");
    return {
      name: server.name,
      icon: server.icon,
      description: server.description,
      memberCount: server._count.members,
    };
  }

  async regenerateInviteCode(serverId: string, userId: string) {
    await this.requireServer(serverId);
    await checkPermission(userId, serverId, Permission.GENERATE_INVITE);

    const inviteCode = await this.generateUniqueInviteCode();
    const updated = await prisma.server.update({
      where: { id: serverId },
      data: { inviteCode },
    });

    await createAuditEntry(serverId, userId, "INVITE_REGENERATE", "Server", serverId);

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("server:updated", {
        server: { id: updated.id, inviteCode: updated.inviteCode },
      });
    }

    return toServerResponse(updated);
  }

  async transferOwnership(
    serverId: string,
    newOwnerId: string,
    userId: string,
  ) {
    const server = await this.requireServer(serverId);
    if (server.ownerId !== userId)
      throw new AppError(
        "Only the owner can transfer ownership",
        403,
        "NOT_OWNER",
      );
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: newOwnerId, serverId } },
    });
    if (!member)
      throw new AppError(
        "New owner must be a member of the server",
        400,
        "NEW_OWNER_NOT_MEMBER",
      );
    await prisma.server.update({
      where: { id: serverId },
      data: { ownerId: newOwnerId },
    });

    await createAuditEntry(serverId, userId, "OWNERSHIP_TRANSFER", "User", newOwnerId);

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("server:ownership_transferred", {
        serverId,
        newOwnerId,
      });
    }
  }
}
