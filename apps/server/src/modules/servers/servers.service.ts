import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { generateId } from "../../utils/snowflake.js";
import { CreateServerDto, UpdateServerDto } from "./servers.schema.js";
import { getIO } from "../../websocket/index.js";
import {
  toServerResponse,
  toMemberResponse,
  toServerBanResponse,
} from "./servers.mapper.js";
import { toChannelResponse } from "../channels/channels.mapper.js";
import {
  checkPermission,
  checkRoleHierarchy,
} from "../../utils/checkPermission.js";
import { Permission, PermissionUtils } from "@sprava/shared";

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

  async create(dto: CreateServerDto, ownerId: string) {
    return prisma.$transaction(async (tx) => {
      const server = await tx.server.create({
        data: {
          id: generateId(),
          name: dto.name,
          icon: dto.icon,
          description: dto.description,
          ownerId,
        },
      });

      await tx.serverMember.create({
        data: { serverId: server.id, userId: ownerId },
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
    await prisma.server.delete({ where: { id: serverId } });
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

  async getMembers(serverId: string, userId: string) {
    await this.requireMember(serverId, userId);
    const members = await prisma.serverMember.findMany({ where: { serverId } });
    return members.map(toMemberResponse);
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

    const io = getIO();
    if (io) {
      const channels = await prisma.channel.findMany({
        where: { serverId: server.id },
        select: { id: true },
      });
      io.in(`user:${userId}`).socketsJoin(`server:${server.id}`);
      for (const { id } of channels) {
        io.in(`user:${userId}`).socketsJoin(`channel:${id}`);
      }
      io.to(`server:${server.id}`).emit("server:member_join", {
        serverId: server.id,
        userId,
      });
    }

    return toServerResponse(server);
  }

  async kickMember(serverId: string, targetUserId: string, userId: string) {
    await checkPermission(userId, serverId, Permission.KICK);
    await checkRoleHierarchy(userId, targetUserId, serverId);
    await prisma.serverMember.delete({
      where: { userId_serverId: { userId: targetUserId, serverId } },
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
      await tx.serverBan.create({
        data: { serverId, userId: targetUserId, reason },
      });
      await tx.serverMember.delete({
        where: { userId_serverId: { userId: targetUserId, serverId } },
      });
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
  }

  async unbanMember(serverId: string, targetUserId: string, userId: string) {
    await checkPermission(userId, serverId, Permission.UNBAN);
    await prisma.serverBan.delete({
      where: { userId_serverId: { userId: targetUserId, serverId } },
    });
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
    await prisma.serverMember.delete({
      where: { userId_serverId: { userId, serverId } },
    });

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
  }

  async getBans(serverId: string, userId: string) {
    await checkPermission(userId, serverId, Permission.BAN | Permission.UNBAN);
    const bans = await prisma.serverBan.findMany({ where: { serverId } });
    return bans.map(toServerBanResponse);
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

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("server:ownership_transferred", {
        serverId,
        newOwnerId,
      });
    }
  }
}
