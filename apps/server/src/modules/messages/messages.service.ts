import { prisma } from "../../config/db.js";
import type { EditMessageDto, ReplyMessageDto } from "./messages.schema.js";
import { generateId } from "../../utils/snowflake.js";
import { AppError } from "../../utils/AppError.js";
import { checkPermission } from "../../utils/checkPermission.js";
import { Permission } from "@sprava/shared";
import { getIO } from "../../websocket/index.js";
import { toMessageEditResponse, toMessageResponse } from "./messages.mapper.js";

export class MessagesService {
  async editMessage(dto: EditMessageDto, messageId: string, userId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404, "MESSAGE_NOT_FOUND");
    }
    if (message.deletedAt) {
      throw new AppError("Message has been deleted", 410, "MESSAGE_DELETED");
    }

    if (message.authorId !== userId) {
      throw new AppError(
        "You don't have permission to edit this message",
        403,
        "NOT_AUTHOR",
      );
    }
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { content: dto.content, editedAt: new Date() },
    });

    const response = toMessageEditResponse(updatedMessage);

    const io = getIO();
    if (io) {
      if (message.channelId)
        io.to(`channel:${message.channelId}`).emit("channel:message_edit", {
          ...response,
          channelId: message.channelId,
        });
      else if (message.dmConversationId)
        io.to(`dm:${message.dmConversationId}`).emit("dm:message_edit", {
          ...response,
          dmConversationId: message.dmConversationId,
        });
    }

    return response;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.deletedAt) {
      throw new AppError("Message not found", 404, "MESSAGE_NOT_FOUND");
    }

    if (message.authorId !== userId) {
      throw new AppError(
        "You don't have permission to delete this message",
        403,
        "NOT_AUTHOR",
      );
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    const io = getIO();
    if (io) {
      if (message.channelId)
        io.to(`channel:${message.channelId}`).emit("channel:message_delete", {
          messageId,
          channelId: message.channelId,
        });
      else if (message.dmConversationId)
        io.to(`dm:${message.dmConversationId}`).emit("dm:message_delete", {
          messageId,
          dmConversationId: message.dmConversationId,
        });
    }
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { dmConversation: true, channel: true },
    });

    if (!message || message.deletedAt) {
      throw new AppError("Message not found", 404, "MESSAGE_NOT_FOUND");
    }

    if (!this.isEmoji(emoji)) {
      throw new AppError("Invalid emoji", 400, "INVALID_EMOJI");
    }

    if (message.dmConversation) {
      const isParticipant = await prisma.dmParticipant.findFirst({
        where: {
          dmConversationId: message.dmConversationId!,
          userId,
        },
      });

      if (!isParticipant) {
        throw new AppError("Message not found", 404, "MESSAGE_NOT_FOUND");
      }
    } else if (message.channel) {
      const channel = await prisma.channel.findUnique({
        where: { id: message.channelId! },
        include: { server: true },
      });

      if (!channel) {
        throw new AppError("Message not found", 404, "MESSAGE_NOT_FOUND");
      }

      const isMember = await prisma.serverMember.findFirst({
        where: {
          serverId: channel.serverId,
          userId,
        },
      });

      if (!isMember) {
        throw new AppError("Message not found", 404, "MESSAGE_NOT_FOUND");
      }
    }

    const existingReaction = await prisma.reaction.findFirst({
      where: {
        messageId,
        userId,
        emoji,
      },
    });

    if (existingReaction) {
      throw new AppError(
        "You have already reacted with this emoji",
        400,
        "REACTION_ALREADY_EXISTS",
      );
    }

    const reaction = await prisma.reaction.create({
      data: {
        id: generateId(),
        messageId,
        userId,
        emoji,
      },
    });

    const io = getIO();
    if (io) {
      const payload = { messageId, reaction: { id: reaction.id, emoji, userId } };
      if (message.channelId)
        io.to(`channel:${message.channelId}`).emit("channel:reaction_add", {
          ...payload,
          channelId: message.channelId,
        });
      else if (message.dmConversationId)
        io.to(`dm:${message.dmConversationId}`).emit("dm:reaction_add", {
          ...payload,
          dmConversationId: message.dmConversationId,
        });
    }
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    const reaction = await prisma.reaction.findFirst({
      where: { messageId, userId, emoji },
      include: {
        message: { select: { channelId: true, dmConversationId: true } },
      },
    });

    if (!reaction) {
      throw new AppError("Reaction not found", 404, "REACTION_NOT_FOUND");
    }

    await prisma.reaction.delete({ where: { id: reaction.id } });

    const io = getIO();
    if (io) {
      const payload = { messageId, reaction: { id: reaction.id, emoji, userId } };
      if (reaction.message.channelId)
        io.to(`channel:${reaction.message.channelId}`).emit(
          "channel:reaction_remove",
          { ...payload, channelId: reaction.message.channelId },
        );
      else if (reaction.message.dmConversationId)
        io.to(`dm:${reaction.message.dmConversationId}`).emit(
          "dm:reaction_remove",
          { ...payload, dmConversationId: reaction.message.dmConversationId },
        );
    }
  }

  async replyMessage(
    parentId: string,
    dto: ReplyMessageDto,
    userId: string,
  ) {
    const parent = await prisma.message.findUnique({
      where: { id: parentId },
      include: { channel: { include: { server: true } } },
    });

    if (!parent || parent.deletedAt) {
      throw new AppError("Message not found", 404, "MESSAGE_NOT_FOUND");
    }

    // Verify the replying user has access to the same context
    if (parent.channelId) {
      await checkPermission(
        userId,
        parent.channel!.serverId,
        Permission.POST_MESSAGES,
        parent.channelId,
      );
    } else if (parent.dmConversationId) {
      const isParticipant = await prisma.dmParticipant.findUnique({
        where: {
          userId_dmConversationId: {
            userId,
            dmConversationId: parent.dmConversationId,
          },
        },
      });
      if (!isParticipant) {
        throw new AppError("Message not found", 404, "MESSAGE_NOT_FOUND");
      }
    }

    const { message, attachments } = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          id: generateId(),
          content: dto.content ?? "",
          authorId: userId,
          replyToId: parentId,
          channelId: parent.channelId,
          dmConversationId: parent.dmConversationId,
        },
        include: { author: { select: { id: true, username: true, avatar: true } } },
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
        const atts = await tx.attachment.findMany({ where: { messageId: msg.id } });
        return { message: msg, attachments: atts };
      }

      return { message: msg, attachments: [] };
    });

    const response = toMessageResponse({
      ...message,
      reactions: [],
      attachments,
      replyToId: parentId,
      replyTo: {
        id: parent.id,
        content: parent.content,
        deletedAt: parent.deletedAt,
        author: await prisma.user
          .findUnique({
            where: { id: parent.authorId },
            select: { id: true, username: true, avatar: true },
          })
          .then((u) => u ?? { id: parent.authorId, username: "Unknown", avatar: null }),
      },
    });

    const io = getIO();
    if (parent.channelId) {
      io?.to(`channel:${parent.channelId}`).emit("channel:message_new", { message: response });
    } else if (parent.dmConversationId) {
      io?.to(`dm:${parent.dmConversationId}`).emit("dm:message_new", {
        message: response,
        dmConversationId: parent.dmConversationId,
      });
    }

    return response;
  }

  private isEmoji(str: string) {
    const emojiRegex = /^\p{Emoji}(\p{Emoji_Modifier}|\uFE0F)?$/u;
    return emojiRegex.test(str);
  }
}
