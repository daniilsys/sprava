import { prisma } from "../../config/db.js";
import type {
  CreateChannelDto,
  UpdateChannelDto,
  SendMessageDto,
  ChannelRuleDto,
  DeleteChannelRuleDto,
  ReorderChannelsDto,
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
import { createAuditEntry } from "../audit/audit.service.js";

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
          parentId: dto.parentId,
          position: count, // append at the end (0-indexed)
        },
        include: { server: true },
      });
    });

    const response = toChannelResponse(channel);

    await createAuditEntry(dto.serverId, userId, "CHANNEL_CREATE", "Channel", channel.id, {
      channelName: dto.name,
      channelType: dto.type,
    });

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
          parentId: dto.parentId !== undefined ? dto.parentId : undefined,
          ...(dto.syncParentRules !== undefined ? { syncParentRules: dto.syncParentRules } : {}),
        },
      });
    });

    const response = toChannelResponse(updatedChannel);

    await createAuditEntry(channel.serverId, userId, "CHANNEL_UPDATE", "Channel", channelId, {
      channelName: dto.name,
      channelType: dto.type,
    });

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

    await createAuditEntry(serverId, userId, "CHANNEL_DELETE", "Channel", channelId, {
      channelName: channel.name,
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
    if (channel.type === "VOICE") {
      throw new AppError("Cannot send messages in a voice channel", 400, "VOICE_CHANNEL_NO_MESSAGES");
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
          ...(dto.replyToId ? { replyToId: dto.replyToId } : {}),
        },
        include: {
          author: { select: { id: true, username: true, avatar: true } },
          replyTo: {
            include: {
              author: { select: { id: true, username: true, avatar: true } },
            },
          },
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
    const io = getIO();
    if (io) {
      // Full message to users focused on this channel
      io.to(`channel:${channelId}`).emit("channel:message_new", { message: response });
      // P3: Lightweight unread notification to the whole server
      // (users not focused on this channel use this for unread counts)
      io.to(`server:${channel.serverId}`).emit("channel:unread_update", {
        channelId,
        messageId: message.id,
        authorId: message.authorId,
      });
    }

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

    let rule;
    if (dto.roleId) {
      rule = await prisma.channelRule.upsert({
        where: { channelId_roleId: { channelId, roleId: dto.roleId } },
        create: { id: generateId(), channelId, roleId: dto.roleId, ...data },
        update: data,
      });
    } else {
      rule = await prisma.channelRule.upsert({
        where: { channelId_memberId: { channelId, memberId: dto.memberId! } },
        create: { id: generateId(), channelId, memberId: dto.memberId, ...data },
        update: data,
      });
    }

    // Sync rules to children if this is a category
    if (channel.type === "PARENT") {
      const children = await prisma.channel.findMany({
        where: { parentId: channelId, syncParentRules: true },
      });
      if (children.length > 0) {
        await prisma.$transaction(
          children.map((child) =>
            dto.roleId
              ? prisma.channelRule.upsert({
                  where: { channelId_roleId: { channelId: child.id, roleId: dto.roleId! } },
                  create: { id: generateId(), channelId: child.id, roleId: dto.roleId, ...data },
                  update: data,
                })
              : prisma.channelRule.upsert({
                  where: { channelId_memberId: { channelId: child.id, memberId: dto.memberId! } },
                  create: { id: generateId(), channelId: child.id, memberId: dto.memberId, ...data },
                  update: data,
                }),
          ),
        );
      }
    }

    const response = toChannelRuleResponse(rule);

    // Emit socket event to all server members
    const io = getIO();
    if (io) {
      io.to(`server:${channel.serverId}`).emit("channel:rule_updated", {
        serverId: channel.serverId,
        rule: response,
      });

      // Also emit for synced children
      if (channel.type === "PARENT") {
        const childRules = await prisma.channelRule.findMany({
          where: {
            channel: { parentId: channelId, syncParentRules: true },
            ...(dto.roleId ? { roleId: dto.roleId } : { memberId: dto.memberId }),
          },
        });
        for (const cr of childRules) {
          io.to(`server:${channel.serverId}`).emit("channel:rule_updated", {
            serverId: channel.serverId,
            rule: toChannelRuleResponse(cr),
          });
        }
      }
    }

    return response;
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
    } else {
      const rule = await prisma.channelRule.findUnique({
        where: { channelId_memberId: { channelId, memberId: dto.memberId! } },
      });
      if (!rule) throw new AppError("Rule not found", 404, "RULE_NOT_FOUND");
      await prisma.channelRule.delete({
        where: { channelId_memberId: { channelId, memberId: dto.memberId! } },
      });
    }

    // Collect affected channel IDs for socket emission
    const affectedChannelIds = [channelId];

    // Sync rule deletion to children if this is a category
    if (channel.type === "PARENT") {
      const children = await prisma.channel.findMany({
        where: { parentId: channelId, syncParentRules: true },
      });
      for (const child of children) {
        affectedChannelIds.push(child.id);
        if (dto.roleId) {
          await prisma.channelRule.deleteMany({
            where: { channelId: child.id, roleId: dto.roleId },
          });
        } else {
          await prisma.channelRule.deleteMany({
            where: { channelId: child.id, memberId: dto.memberId! },
          });
        }
      }
    }

    // Emit socket events
    const io = getIO();
    if (io) {
      for (const cId of affectedChannelIds) {
        io.to(`server:${channel.serverId}`).emit("channel:rule_deleted", {
          serverId: channel.serverId,
          channelId: cId,
          roleId: dto.roleId ?? null,
          memberId: dto.memberId ?? null,
        });
      }
    }
  }

  async getMessages(
    channelId: string,
    userId: string,
    before?: string,
    limit?: number,
    around?: string,
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

    if (around) {
      const half = Math.floor((limit ?? 50) / 2);
      const [beforeMsgs, afterMsgs] = await Promise.all([
        prisma.message.findMany({
          where: { channelId, deletedAt: null, id: { lt: around } },
          orderBy: { createdAt: "desc" },
          take: half,
          include: {
            author: true, reactions: true, attachments: true,
            replyTo: { include: { author: { select: { id: true, username: true, avatar: true } } } },
          },
        }),
        prisma.message.findMany({
          where: { channelId, deletedAt: null, id: { gte: around } },
          orderBy: { createdAt: "asc" },
          take: half + 1,
          include: {
            author: true, reactions: true, attachments: true,
            replyTo: { include: { author: { select: { id: true, username: true, avatar: true } } } },
          },
        }),
      ]);
      const combined = [...beforeMsgs.reverse(), ...afterMsgs];
      return combined.map(toMessageResponse);
    }

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

  async searchMessages(
    channelId: string,
    userId: string,
    query: string,
    limit?: number,
  ) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel)
      throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");

    // Check user is a member of the server owning the channel
    const membership = await prisma.serverMember.findUnique({
      where: {
        userId_serverId: { userId, serverId: channel.serverId },
      },
    });
    if (!membership)
      throw new AppError("Not a server member", 403, "NOT_SERVER_MEMBER");

    const messages = await prisma.message.findMany({
      where: {
        channelId,
        deletedAt: null,
        content: { contains: query, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: limit ?? 25,
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

    return messages.map(toMessageResponse);
  }

  async reorder(serverId: string, dto: ReorderChannelsDto, userId: string) {
    await checkPermission(userId, serverId, Permission.CONFIGURE_CHANNELS);

    // Fetch all server channels to validate against
    const serverChannels = await prisma.channel.findMany({
      where: { serverId },
      select: { id: true, type: true },
    });
    const serverChannelMap = new Map(serverChannels.map((c) => [c.id, c]));

    // Validate: all IDs must belong to this server
    for (const ch of dto.channels) {
      if (!serverChannelMap.has(ch.id)) {
        throw new AppError(
          `Channel ${ch.id} does not belong to this server`,
          400,
          "INVALID_CHANNEL",
        );
      }
    }

    // Build a lookup for the incoming payload
    const payloadMap = new Map(dto.channels.map((c) => [c.id, c]));

    // Validate parentId references
    for (const ch of dto.channels) {
      if (ch.parentId) {
        const parent = serverChannelMap.get(ch.parentId);
        if (!parent) {
          throw new AppError(
            `Parent ${ch.parentId} does not belong to this server`,
            400,
            "INVALID_PARENT",
          );
        }
        if (parent.type !== "PARENT") {
          throw new AppError(
            `Channel ${ch.parentId} is not a category`,
            400,
            "INVALID_PARENT",
          );
        }
      }
      // Categories cannot have a parent
      const channelType = serverChannelMap.get(ch.id)!.type;
      if (channelType === "PARENT" && ch.parentId) {
        throw new AppError(
          "Categories cannot be nested inside other categories",
          400,
          "INVALID_PARENT",
        );
      }
    }

    // Validate: positions must be contiguous (0..n-1) per parentId group
    const groups = new Map<string, number[]>();
    for (const ch of dto.channels) {
      const key = ch.parentId ?? "__root";
      const list = groups.get(key) ?? [];
      list.push(ch.position);
      groups.set(key, list);
    }
    for (const [key, positions] of groups) {
      const sorted = [...positions].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] !== i) {
          throw new AppError(
            `Positions must be contiguous (0..n-1) within group ${key}`,
            400,
            "INVALID_POSITIONS",
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const ch of dto.channels) {
        await tx.channel.update({
          where: { id: ch.id },
          data: { position: ch.position, parentId: ch.parentId },
        });
      }
    });

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("channels:reordered", {
        serverId,
        channels: dto.channels.map((ch) => ({
          id: ch.id,
          position: ch.position,
          parentId: ch.parentId ?? null,
        })),
      });
    }
  }
}
