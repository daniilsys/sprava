import { prisma } from "../../config/db.js";
import { generateId } from "../../utils/snowflake.js";
import { AppError } from "../../utils/AppError.js";
import { checkPermission } from "../../utils/checkPermission.js";
import { Permission } from "@sprava/shared";
import { getIO } from "../../websocket/index.js";
import { toMessageResponse } from "../messages/messages.mapper.js";

const MAX_PINS_PER_CONTEXT = 50;

const messageInclude = {
  author: { select: { id: true, username: true, avatar: true } },
  reactions: true,
  attachments: true,
  replyTo: {
    include: {
      author: { select: { id: true, username: true, avatar: true } },
    },
  },
} as const;

export class PinsService {
  async pinMessage(
    channelId: string | null,
    dmConversationId: string | null,
    messageId: string,
    userId: string,
  ) {
    // Verify the message exists and belongs to the correct context
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: messageInclude,
    });
    if (!message) {
      throw new AppError("Message not found", 404, "MESSAGE_NOT_FOUND");
    }

    if (channelId) {
      if (message.channelId !== channelId) {
        throw new AppError(
          "Message does not belong to this channel",
          400,
          "MESSAGE_WRONG_CONTEXT",
        );
      }

      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
      });
      if (!channel) {
        throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");
      }

      await checkPermission(
        userId,
        channel.serverId,
        Permission.MODERATE_MESSAGES,
        channelId,
      );
    } else if (dmConversationId) {
      if (message.dmConversationId !== dmConversationId) {
        throw new AppError(
          "Message does not belong to this DM",
          400,
          "MESSAGE_WRONG_CONTEXT",
        );
      }

      const dm = await prisma.dmConversation.findUnique({
        where: { id: dmConversationId },
        include: { participants: true },
      });
      if (!dm) {
        throw new AppError("DM not found", 404, "DM_NOT_FOUND");
      }

      const isParticipant = dm.participants.some((p) => p.userId === userId);
      if (!isParticipant) {
        throw new AppError(
          "You are not a participant of this DM",
          403,
          "NOT_DM_PARTICIPANT",
        );
      }
    } else {
      throw new AppError("Invalid context", 400, "INVALID_CONTEXT");
    }

    // Check not already pinned
    const existing = await prisma.pin.findUnique({
      where: { messageId },
    });
    if (existing) {
      throw new AppError("Message already pinned", 400, "ALREADY_PINNED");
    }

    // Check max pins per context
    const pinCount = await prisma.pin.count({
      where: channelId ? { channelId } : { dmConversationId },
    });
    if (pinCount >= MAX_PINS_PER_CONTEXT) {
      throw new AppError(
        `Cannot pin more than ${MAX_PINS_PER_CONTEXT} messages`,
        400,
        "PIN_LIMIT_REACHED",
      );
    }

    const pin = await prisma.pin.create({
      data: {
        id: generateId(),
        messageId,
        channelId,
        dmConversationId,
        pinnedById: userId,
      },
      include: {
        message: { include: messageInclude },
        pinnedBy: { select: { id: true, username: true, avatar: true } },
      },
    });

    // Emit socket event
    const io = getIO();
    if (io) {
      if (channelId) {
        const channel = await prisma.channel.findUnique({
          where: { id: channelId },
        });
        if (channel) {
          io.to(`server:${channel.serverId}`).emit("channel:message_pinned", {
            channelId,
            messageId,
            pinnedBy: userId,
          });
        }
      } else if (dmConversationId) {
        io.to(`dm:${dmConversationId}`).emit("dm:message_pinned", {
          dmConversationId,
          messageId,
          pinnedBy: userId,
        });
      }
    }

    return {
      id: pin.id,
      messageId: pin.messageId,
      channelId: pin.channelId,
      dmConversationId: pin.dmConversationId,
      pinnedById: pin.pinnedById,
      pinnedAt: pin.pinnedAt,
      message: toMessageResponse(pin.message),
      pinnedBy: pin.pinnedBy,
    };
  }

  async unpinMessage(
    channelId: string | null,
    dmConversationId: string | null,
    messageId: string,
    userId: string,
  ) {
    const pin = await prisma.pin.findUnique({
      where: { messageId },
    });
    if (!pin) {
      throw new AppError("Pin not found", 404, "PIN_NOT_FOUND");
    }

    if (channelId) {
      if (pin.channelId !== channelId) {
        throw new AppError(
          "Pin does not belong to this channel",
          400,
          "PIN_WRONG_CONTEXT",
        );
      }

      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
      });
      if (!channel) {
        throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");
      }

      await checkPermission(
        userId,
        channel.serverId,
        Permission.MODERATE_MESSAGES,
        channelId,
      );
    } else if (dmConversationId) {
      if (pin.dmConversationId !== dmConversationId) {
        throw new AppError(
          "Pin does not belong to this DM",
          400,
          "PIN_WRONG_CONTEXT",
        );
      }

      const dm = await prisma.dmConversation.findUnique({
        where: { id: dmConversationId },
        include: { participants: true },
      });
      if (!dm) {
        throw new AppError("DM not found", 404, "DM_NOT_FOUND");
      }

      const isParticipant = dm.participants.some((p) => p.userId === userId);
      if (!isParticipant) {
        throw new AppError(
          "You are not a participant of this DM",
          403,
          "NOT_DM_PARTICIPANT",
        );
      }
    } else {
      throw new AppError("Invalid context", 400, "INVALID_CONTEXT");
    }

    await prisma.pin.delete({ where: { messageId } });

    // Emit socket event
    const io = getIO();
    if (io) {
      if (channelId) {
        const channel = await prisma.channel.findUnique({
          where: { id: channelId },
        });
        if (channel) {
          io.to(`server:${channel.serverId}`).emit(
            "channel:message_unpinned",
            { channelId, messageId },
          );
        }
      } else if (dmConversationId) {
        io.to(`dm:${dmConversationId}`).emit("dm:message_unpinned", {
          dmConversationId,
          messageId,
        });
      }
    }
  }

  async getPins(channelId: string | null, dmConversationId: string | null, userId: string) {
    if (channelId) {
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
      });
      if (!channel) {
        throw new AppError("Channel not found", 404, "CHANNEL_NOT_FOUND");
      }

      await checkPermission(
        userId,
        channel.serverId,
        Permission.READ_MESSAGES,
        channelId,
      );
    } else if (dmConversationId) {
      const dm = await prisma.dmConversation.findUnique({
        where: { id: dmConversationId },
        include: { participants: true },
      });
      if (!dm) {
        throw new AppError("DM not found", 404, "DM_NOT_FOUND");
      }

      const isParticipant = dm.participants.some((p) => p.userId === userId);
      if (!isParticipant) {
        throw new AppError(
          "You are not a participant of this DM",
          403,
          "NOT_DM_PARTICIPANT",
        );
      }
    } else {
      throw new AppError("Invalid context", 400, "INVALID_CONTEXT");
    }

    const pins = await prisma.pin.findMany({
      where: channelId ? { channelId } : { dmConversationId },
      orderBy: { pinnedAt: "desc" },
      include: {
        message: { include: messageInclude },
        pinnedBy: { select: { id: true, username: true, avatar: true } },
      },
    });

    return pins.map((pin) => ({
      id: pin.id,
      messageId: pin.messageId,
      channelId: pin.channelId,
      dmConversationId: pin.dmConversationId,
      pinnedById: pin.pinnedById,
      pinnedAt: pin.pinnedAt,
      message: toMessageResponse(pin.message),
      pinnedBy: pin.pinnedBy,
    }));
  }
}
