import { prisma } from "../../config/db.js";
import type {
  CreateChannelDto,
  UpdateChannelDto,
  SendMessageDto,
  ChannelRuleDto,
  DeleteChannelRuleDto,
} from "./channels.schema.js";
import { generateId } from "../../utils/snowflake.js";
import { AppError } from "../../utils/AppError.js";
import { checkPermission } from "../../utils/checkPermission.js";
import { Permission } from "@sprava/shared";
import { getIO } from "../../websocket/index.js";
import {
  toChannelReadStateResponse,
  toChannelResponse,
  toChannelRuleResponse,
} from "./channels.mapper.js";
import { toMessageResponse } from "../messages/messages.mapper.js";

export class ChannelsService {
  async create(dto: CreateChannelDto, userId: string) {
    await checkPermission(userId, dto.serverId, Permission.CONFIGURE_CHANNELS);

    const channel = await prisma.$transaction(async (tx) => {
      const count = await tx.channel.count({
        where: { serverId: dto.serverId },
      });

      return tx.channel.create({
        data: {
          id: generateId(),
          name: dto.name,
          type: dto.type,
          serverId: dto.serverId,
          position: count, // append at the end (0-indexed)
        },
        include: { server: true },
      });
    });

    const response = toChannelResponse(channel);

    const io = getIO();
    if (io) {
      io.in(`server:${dto.serverId}`).socketsJoin(`channel:${channel.id}`);
      io.to(`server:${dto.serverId}`).emit("channel:created", {
        channel: response,
      });
    }

    return response;
  }

  async update(channelId: string, dto: UpdateChannelDto, userId: string) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel)
      throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");

    await checkPermission(
      userId,
      channel.serverId,
      Permission.CONFIGURE_CHANNELS,
    );

    const updatedChannel = await prisma.$transaction(async (tx) => {
      if (dto.position !== undefined && dto.position !== channel.position) {
        const oldPos = channel.position;
        const newPos = dto.position;

        if (newPos > oldPos) {
          // Moving down: shift channels in (oldPos, newPos] up by -1
          await tx.channel.updateMany({
            where: {
              serverId: channel.serverId,
              position: { gt: oldPos, lte: newPos },
            },
            data: { position: { decrement: 1 } },
          });
        } else {
          // Moving up: shift channels in [newPos, oldPos) down by +1
          await tx.channel.updateMany({
            where: {
              serverId: channel.serverId,
              position: { gte: newPos, lt: oldPos },
            },
            data: { position: { increment: 1 } },
          });
        }
      }

      return tx.channel.update({
        where: { id: channelId },
        data: {
          name: dto.name,
          type: dto.type,
          ...(dto.position !== undefined ? { position: dto.position } : {}),
        },
      });
    });

    const response = toChannelResponse(updatedChannel);

    const io = getIO();
    if (io) {
      io.to(`server:${channel.serverId}`).emit("channel:updated", {
        channel: response,
      });
    }

    return response;
  }

  async delete(channelId: string, userId: string) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel)
      throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");

    await checkPermission(
      userId,
      channel.serverId,
      Permission.CONFIGURE_CHANNELS,
    );

    const { serverId, position: deletedPos } = channel;

    await prisma.$transaction(async (tx) => {
      await tx.channel.delete({ where: { id: channelId } });
      // Close the gap: shift all channels after the deleted one up
      await tx.channel.updateMany({
        where: { serverId, position: { gt: deletedPos } },
        data: { position: { decrement: 1 } },
      });
    });

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("channel:deleted", {
        channelId,
        serverId,
      });
      io.in(`channel:${channelId}`).socketsLeave(`channel:${channelId}`);
    }
  }

  async getById(channelId: string, userId: string) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { server: true },
    });
    if (!channel) {
      throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");
    }

    await checkPermission(
      userId,
      channel.serverId,
      Permission.VIEW_CHANNEL,
      channelId,
    );

    return toChannelResponse(channel);
  }

  async sendMessage(channelId: string, dto: SendMessageDto, userId: string) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { server: true },
    });
    if (!channel) {
      throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");
    }

    await checkPermission(
      userId,
      channel.serverId,
      Permission.POST_MESSAGES,
      channelId,
    );

    const { message, attachments } = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          id: generateId(),
          content: dto.content ?? "",
          channelId,
          authorId: userId,
        },
        include: {
          author: { select: { id: true, username: true, avatar: true } },
        },
      });

      if (dto.attachments?.length) {
        await tx.attachment.createMany({
          data: dto.attachments.map((a) => ({
            id: generateId(),
            url: a.url,
            filename: a.filename,
            size: a.size,
            mimeType: a.mimeType,
            messageId: msg.id,
          })),
        });
        const atts = await tx.attachment.findMany({
          where: { messageId: msg.id },
        });
        return { message: msg, attachments: atts };
      }

      return { message: msg, attachments: [] };
    });

    const response = toMessageResponse({
      ...message,
      reactions: [],
      attachments,
    });
    getIO()
      ?.to(`channel:${channelId}`)
      .emit("channel:message_new", { message: response });

    return response;
  }

  async getRules(channelId: string, userId: string) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel)
      throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");

    await checkPermission(
      userId,
      channel.serverId,
      Permission.VIEW_CHANNEL,
      channelId,
    );

    const rules = await prisma.channelRule.findMany({ where: { channelId } });
    return rules.map(toChannelRuleResponse);
  }

  async upsertRule(channelId: string, dto: ChannelRuleDto, userId: string) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { server: true },
    });
    if (!channel)
      throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");
    await checkPermission(
      userId,
      channel.serverId,
      Permission.CONFIGURE_CHANNELS,
    );

    const data = { allow: BigInt(dto.allow), deny: BigInt(dto.deny) };

    if (dto.roleId) {
      const rule = await prisma.channelRule.upsert({
        where: { channelId_roleId: { channelId, roleId: dto.roleId } },
        create: { id: generateId(), channelId, roleId: dto.roleId, ...data },
        update: data,
      });
      return toChannelRuleResponse(rule);
    }

    const rule = await prisma.channelRule.upsert({
      where: { channelId_memberId: { channelId, memberId: dto.memberId! } },
      create: { id: generateId(), channelId, memberId: dto.memberId, ...data },
      update: data,
    });
    return toChannelRuleResponse(rule);
  }

  async deleteRule(
    channelId: string,
    dto: DeleteChannelRuleDto,
    userId: string,
  ) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { server: true },
    });
    if (!channel)
      throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");
    await checkPermission(
      userId,
      channel.serverId,
      Permission.CONFIGURE_CHANNELS,
    );

    if (dto.roleId) {
      const rule = await prisma.channelRule.findUnique({
        where: { channelId_roleId: { channelId, roleId: dto.roleId } },
      });
      if (!rule) throw new AppError("Rule not found", 404, "RULE_NOT_FOUND");
      await prisma.channelRule.delete({
        where: { channelId_roleId: { channelId, roleId: dto.roleId } },
      });
      return;
    }

    const rule = await prisma.channelRule.findUnique({
      where: { channelId_memberId: { channelId, memberId: dto.memberId! } },
    });
    if (!rule) throw new AppError("Rule not found", 404, "RULE_NOT_FOUND");
    await prisma.channelRule.delete({
      where: { channelId_memberId: { channelId, memberId: dto.memberId! } },
    });
  }

  async getMessages(
    channelId: string,
    userId: string,
    before?: string,
    limit?: number,
  ) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { server: true },
    });
    if (!channel)
      throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");

    await checkPermission(
      userId,
      channel.serverId,
      Permission.READ_MESSAGES,
      channelId,
    );

    const messages = await prisma.message.findMany({
      where: {
        channelId,
        deletedAt: null,
        ...(before && { id: { lt: before } }),
      },
      orderBy: { createdAt: "desc" },
      take: limit ?? 50,
      include: {
        author: true,
        reactions: true,
        attachments: true,
        replyTo: {
          include: {
            author: { select: { id: true, username: true, avatar: true } },
          },
        },
      },
    });

    return messages.map(toMessageResponse).reverse();
  }

  async getReadState(channelId: string, userId: string) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { server: true },
    });
    if (!channel)
      throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");

    await checkPermission(
      userId,
      channel.serverId,
      Permission.READ_MESSAGES,
      channelId,
    );

    const readState = await prisma.readState.findUnique({
      where: { userId_channelId: { userId, channelId } },
    });
    if (!readState) {
      return {
        channelId,
        lastReadMessageId: null,
      };
    }
    return toChannelReadStateResponse(readState);
  }

  async updateReadState(
    channelId: string,
    userId: string,
    lastReadMessageId: string,
  ) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { server: true },
    });
    if (!channel)
      throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");

    await checkPermission(
      userId,
      channel.serverId,
      Permission.READ_MESSAGES,
      channelId,
    );

    const readState = await prisma.readState.upsert({
      where: { userId_channelId: { userId, channelId } },
      create: { id: generateId(), userId, channelId, lastReadMessageId },
      update: { lastReadMessageId },
    });

    return toChannelReadStateResponse(readState);
  }
}
