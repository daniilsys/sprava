import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { generateId } from "../../utils/snowflake.js";
import type { CreateDmDto, SendMessageDto, UpdateDmDto } from "./dm.schema.js";
import { getIO } from "../../websocket/index.js";
import {
  toDmConversationReadStateResponse,
  toDmResponse,
} from "./dm.mapper.js";
import { toMessageResponse } from "../messages/messages.mapper.js";

const participantsInclude = {
  participants: {
    include: {
      user: { select: { id: true, username: true, avatar: true } },
    },
  },
} as const;

export class DmService {
  async create(dto: CreateDmDto, userId: string) {
    // participantIds includes the creator — group = 3+ total, 1-1 = exactly 2
    const isGroup = dto.participantIds.length > 2;

    if (isGroup) {
      const otherIds = dto.participantIds.filter((id) => id !== userId);

      const friendships = await prisma.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [
            { senderId: userId, receiverId: { in: otherIds } },
            { senderId: { in: otherIds }, receiverId: userId },
          ],
        },
        select: { senderId: true, receiverId: true },
      });

      if (friendships.length !== otherIds.length) {
        throw new AppError(
          "You must be friends with all participants",
          403,
          "NOT_ALL_FRIENDS",
        );
      }

      const group = await prisma.$transaction(async (tx) => {
        const g = await tx.dmConversation.create({
          data: { id: generateId(), type: "GROUP", ownerId: userId },
        });
        for (const participantId of dto.participantIds) {
          await tx.dmParticipant.create({
            data: { dmConversationId: g.id, userId: participantId },
          });
        }
        return g;
      });

      const response = toDmResponse(group);

      const io = getIO();
      if (io) {
        for (const participantId of dto.participantIds) {
          io.in(`user:${participantId}`).socketsJoin(`dm:${group.id}`);
        }
        io.to(`dm:${group.id}`).emit("dm:created", { dm: response });
      }

      return response;
    }

    // 1-1 DM
    const participantId = dto.participantIds.find((id) => id !== userId);
    if (!participantId) {
      throw new AppError(
        "You cannot create a DM with yourself",
        400,
        "INVALID_DM_PARTICIPANTS",
      );
    }

    const [friendship, commonServer] = await Promise.all([
      prisma.friendship.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { senderId: userId, receiverId: participantId },
            { senderId: participantId, receiverId: userId },
          ],
        },
      }),
      prisma.server.findFirst({
        where: {
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: participantId } } },
          ],
        },
        select: { id: true },
      }),
    ]);

    if (!friendship && !commonServer) {
      throw new AppError(
        "You must be friends or share a server to create a DM",
        403,
        "NO_DM_PERMISSION",
      );
    }

    const existingDm = await prisma.dmConversation.findFirst({
      where: {
        type: "PRIVATE",
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
      include: participantsInclude,
    });

    if (existingDm && existingDm.participants.length === 2) {
      return existingDm;
    }

    const dm = await prisma.$transaction(async (tx) => {
      const d = await tx.dmConversation.create({
        data: { id: generateId(), type: "PRIVATE" },
      });
      await tx.dmParticipant.create({
        data: { dmConversationId: d.id, userId },
      });
      await tx.dmParticipant.create({
        data: { dmConversationId: d.id, userId: participantId },
      });
      return d;
    });

    const response = toDmResponse(dm);

    const io = getIO();
    if (io) {
      io.in(`user:${userId}`).socketsJoin(`dm:${dm.id}`);
      io.in(`user:${participantId}`).socketsJoin(`dm:${dm.id}`);
      io.to(`dm:${dm.id}`).emit("dm:created", { dm: response });
    }

    return response;
  }

  async getDmConversations(userId: string) {
    const dms = await prisma.dmConversation.findMany({
      where: { participants: { some: { userId } } },
      include: participantsInclude,
      orderBy: { createdAt: "desc" },
    });
    return dms.map(toDmResponse);
  }

  async sendMessage(dmId: string, dto: SendMessageDto, userId: string) {
    const dm = await prisma.dmConversation.findUnique({
      where: { id: dmId },
      include: participantsInclude,
    });

    if (!dm) throw new AppError("DM not found", 404, "DM_NOT_FOUND");

    const isParticipant = dm.participants.some((p) => p.userId === userId);
    if (!isParticipant)
      throw new AppError(
        "You are not a participant of this DM",
        403,
        "NOT_DM_PARTICIPANT",
      );

    const { message, attachments } = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          id: generateId(),
          content: dto.content ?? "",
          authorId: userId,
          dmConversationId: dmId,
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
    getIO()
      ?.to(`dm:${dmId}`)
      .emit("dm:message_new", { message: response, dmConversationId: dmId });

    return response;
  }

  async getMessages(
    dmId: string,
    userId: string,
    before?: string,
    limit?: number,
    around?: string,
  ) {
    const dm = await prisma.dmConversation.findUnique({
      where: { id: dmId },
      include: participantsInclude,
    });

    if (!dm) throw new AppError("DM not found", 404, "DM_NOT_FOUND");

    const isParticipant = dm.participants.some((p) => p.userId === userId);
    if (!isParticipant)
      throw new AppError(
        "You are not a participant of this DM",
        403,
        "NOT_DM_PARTICIPANT",
      );

    if (around) {
      const half = Math.floor((limit ?? 50) / 2);
      const [beforeMsgs, afterMsgs] = await Promise.all([
        prisma.message.findMany({
          where: { dmConversationId: dmId, deletedAt: null, id: { lt: around } },
          orderBy: { createdAt: "desc" },
          take: half,
          include: {
            author: true, reactions: true, attachments: true,
            replyTo: { include: { author: { select: { id: true, username: true, avatar: true } } } },
          },
        }),
        prisma.message.findMany({
          where: { dmConversationId: dmId, deletedAt: null, id: { gte: around } },
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
        dmConversationId: dmId,
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

  async searchMessages(
    dmId: string,
    userId: string,
    query: string,
    limit?: number,
  ) {
    const dm = await prisma.dmConversation.findUnique({
      where: { id: dmId },
      include: participantsInclude,
    });

    if (!dm) throw new AppError("DM not found", 404, "DM_NOT_FOUND");

    const isParticipant = dm.participants.some((p) => p.userId === userId);
    if (!isParticipant)
      throw new AppError(
        "You are not a participant of this DM",
        403,
        "NOT_DM_PARTICIPANT",
      );

    const messages = await prisma.message.findMany({
      where: {
        dmConversationId: dmId,
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

    return messages.map(toMessageResponse).reverse();
  }

  async update(dmId: string, dto: UpdateDmDto, userId: string) {
    const dm = await prisma.dmConversation.findUnique({
      where: { id: dmId, type: "GROUP" },
    });

    if (!dm) throw new AppError("DM not found", 404, "DM_NOT_FOUND");

    if (dm.ownerId !== userId)
      throw new AppError(
        "Only the DM owner can update the DM",
        403,
        "NOT_DM_OWNER",
      );

    if (!dto.name && !dto.icon)
      throw new AppError(
        "At least one of name or icon must be provided",
        400,
        "INVALID_DM_UPDATE",
      );

    const updated = await prisma.dmConversation.update({
      where: { id: dmId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
      },
    });

    const io = getIO();
    if (io) {
      io.to(`dm:${dmId}`).emit("dm:updated", {
        dm: { id: updated.id, name: updated.name, icon: updated.icon },
      });
    }

    return toDmResponse(updated);
  }

  async leaveGroup(dmId: string, userId: string) {
    const dm = await prisma.dmConversation.findUnique({
      where: { id: dmId, type: "GROUP" },
      include: participantsInclude,
    });

    if (!dm) throw new AppError("DM not found", 404, "DM_NOT_FOUND");

    const isParticipant = dm.participants.some((p) => p.userId === userId);
    if (!isParticipant)
      throw new AppError(
        "You are not a participant of this DM",
        403,
        "NOT_DM_PARTICIPANT",
      );

    const io = getIO();
    if (io) {
      io.to(`dm:${dmId}`).emit("dm:participant_left", { dmConversationId: dmId, userId });
      io.in(`user:${userId}`).socketsLeave(`dm:${dmId}`);
    }

    await prisma.dmParticipant.deleteMany({
      where: { userId, dmConversationId: dmId },
    });

    if (dm.ownerId === userId && dm.participants.length > 1) {
      const newOwner = dm.participants.find((p) => p.userId !== userId);
      if (newOwner) {
        await prisma.dmConversation.update({
          where: { id: dmId },
          data: { ownerId: newOwner.userId },
        });
      }
    }

    // dm.participants is stale — length === 1 means the leaving user was the last one
    if (dm.participants.length === 1) {
      await prisma.dmConversation.delete({ where: { id: dmId } });
    }

    return { message: "Left the DM successfully" };
  }

  async removeParticipant(dmId: string, participantId: string, userId: string) {
    const dm = await prisma.dmConversation.findUnique({
      where: { id: dmId, type: "GROUP" },
      include: participantsInclude,
    });

    if (!dm) throw new AppError("DM not found", 404, "DM_NOT_FOUND");

    if (dm.ownerId !== userId)
      throw new AppError(
        "Only the DM owner can remove participants",
        403,
        "NOT_DM_OWNER",
      );

    const isParticipant = dm.participants.some(
      (p) => p.userId === participantId,
    );
    if (!isParticipant)
      throw new AppError(
        "User is not a participant of this DM",
        404,
        "PARTICIPANT_NOT_FOUND",
      );

    const io = getIO();
    if (io) {
      io.to(`dm:${dmId}`).emit("dm:participant_removed", { dmConversationId: dmId, userId: participantId });
      io.in(`user:${participantId}`).socketsLeave(`dm:${dmId}`);
    }

    await prisma.dmParticipant.deleteMany({
      where: { userId: participantId, dmConversationId: dmId },
    });

    return { message: "Participant removed successfully" };
  }

  async addParticipant(dmId: string, participantId: string, userId: string) {
    const dm = await prisma.dmConversation.findUnique({
      where: { id: dmId, type: "GROUP" },
      include: participantsInclude,
    });

    if (!dm) throw new AppError("DM not found", 404, "DM_NOT_FOUND");

    if (dm.ownerId !== userId)
      throw new AppError(
        "Only the DM owner can add participants",
        403,
        "NOT_DM_OWNER",
      );

    if (dm.participants.length >= 10)
      throw new AppError(
        "DM cannot have more than 10 participants",
        400,
        "DM_PARTICIPANT_LIMIT",
      );

    const isAlreadyParticipant = dm.participants.some(
      (p) => p.userId === participantId,
    );
    if (isAlreadyParticipant)
      throw new AppError(
        "User is already a participant of this DM",
        400,
        "ALREADY_PARTICIPANT",
      );

    await prisma.dmParticipant.create({
      data: { userId: participantId, dmConversationId: dmId },
    });

    const io = getIO();
    if (io) {
      io.in(`user:${participantId}`).socketsJoin(`dm:${dmId}`);
      const participant = await prisma.dmParticipant.findFirst({
        where: { userId: participantId, dmConversationId: dmId },
        include: { user: { select: { id: true, username: true, avatar: true } } },
      });
      io.to(`dm:${dmId}`).emit("dm:participant_added", {
        dmConversationId: dmId,
        participant: participant
          ? { userId: participant.userId, user: participant.user }
          : { userId: participantId },
      });
    }

    return { message: "Participant added successfully", participantId };
  }

  async getReadState(dmId: string, userId: string) {
    const readState = await prisma.readState.findUnique({
      where: { userId_dmConversationId: { userId, dmConversationId: dmId } },
    });
    if (!readState) {
      return { lastReadMessageId: null };
    }

    return toDmConversationReadStateResponse(readState);
  }

  async read(dmId: string, userId: string, lastReadMessageId: string) {
    const readState = await prisma.readState.upsert({
      where: { userId_dmConversationId: { userId, dmConversationId: dmId } },
      create: {
        id: generateId(),
        userId,
        dmConversationId: dmId,
        lastReadMessageId: lastReadMessageId,
      },
      update: { lastReadMessageId: lastReadMessageId },
    });

    return toDmConversationReadStateResponse(readState);
  }
}
