import { prisma } from "../../config/db.js";
import type { UpdateFriendshipDto } from "./friendships.schema.js";
import { AppError } from "../../utils/AppError.js";
import { generateId } from "../../utils/snowflake.js";
import { getIO } from "../../websocket/index.js";

export class FriendshipsService {
  async update(dto: UpdateFriendshipDto, userId: string) {
    const friendship = await this.findFriendship(userId, dto.receiverId);

    if (dto.status === "BLOCKED") {
      const relationship = await prisma.friendship.findUnique({
        where: {
          senderId_receiverId: { senderId: userId, receiverId: dto.receiverId },
        },
      });

      if (relationship) {
        const updated = await prisma.friendship.update({
          where: { id: relationship.id },
          data: { status: "BLOCKED" },
          include: FriendshipsService.friendshipInclude,
        });

        const io = getIO();
        if (io) {
          io.to(`user:${userId}`).emit("friendship:blocked", { friendship: this.toFriendshipResponse(updated) });
        }

        return {
          receiverId: dto.receiverId,
          status: "BLOCKED",
          createdAt: relationship.createdAt,
        };
      } else {
        const created = await prisma.friendship.create({
          data: {
            id: generateId(),
            senderId: userId,
            receiverId: dto.receiverId,
            status: "BLOCKED",
          },
          include: FriendshipsService.friendshipInclude,
        });

        const io = getIO();
        if (io) {
          io.to(`user:${userId}`).emit("friendship:blocked", { friendship: this.toFriendshipResponse(created) });
        }

        return {
          receiverId: dto.receiverId,
          status: "BLOCKED",
          createdAt: new Date(),
        };
      }
    }

    if (!friendship) {
      throw new AppError("Friendship not found", 404, "FRIENDSHIP_NOT_FOUND");
    }

    if (dto.status === "ACCEPTED" && friendship.status === "ACCEPTED") {
      throw new AppError(
        "Cannot accept an already accepted friendship",
        400,
        "ALREADY_ACCEPTED_FRIENDSHIP",
      );
    }

    if (
      dto.status === "ACCEPTED" &&
      friendship.status === "PENDING" &&
      friendship.receiverId !== userId
    )
      throw new AppError(
        "Only the receiver can accept the friendship",
        403,
        "NOT_RECEIVER",
      );

    const updatedFriendship = await prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: dto.status },
      include: FriendshipsService.friendshipInclude,
    });

    if (dto.status === "ACCEPTED") {
      const io = getIO();
      if (io) {
        const payload = this.toFriendshipResponse(updatedFriendship);
        io.to(`user:${updatedFriendship.senderId}`).emit("friendship:accepted", { friendship: payload });
        io.to(`user:${updatedFriendship.receiverId}`).emit("friendship:accepted", { friendship: payload });
      }
    }

    return {
      receiverId: updatedFriendship.receiverId,
      status: updatedFriendship.status,
      createdAt: updatedFriendship.createdAt,
    };
  }

  async sendRequest(receiverUsername: string, userId: string) {
    const receiver = await prisma.user.findFirst({
      where: { username: { equals: receiverUsername, mode: "insensitive" } },
    });

    if (!receiver) {
      throw new AppError("Cannot find this user", 404, "USER_NOT_FOUND");
    }

    const existingFriendship = await this.findFriendship(userId, receiver.id);

    if (existingFriendship) {
      if (existingFriendship.status === "BLOCKED") {
        throw new AppError("Cannot find this user", 404, "USER_NOT_FOUND");
      }
      if (existingFriendship.status === "PENDING") {
        throw new AppError(
          "A pending friendship request already exists between these users",
          400,
          "PENDING_FRIENDSHIP_EXISTS",
        );
      }
      if (existingFriendship.status === "ACCEPTED") {
        throw new AppError(
          "You are already friends with this user",
          400,
          "ALREADY_FRIENDS",
        );
      }
    }

    const newFriendship = await prisma.friendship.create({
      data: {
        id: generateId(),
        senderId: userId,
        receiverId: receiver.id,
        status: "PENDING",
      },
      include: FriendshipsService.friendshipInclude,
    });

    const io = getIO();
    if (io) {
      const payload = this.toFriendshipResponse(newFriendship);
      io.to(`user:${userId}`).emit("friendship:request_sent", { friendship: payload });
      io.to(`user:${receiver.id}`).emit("friendship:request_received", { friendship: payload });
    }

    return {
      receiverId: newFriendship.receiverId,
      status: newFriendship.status,
      createdAt: newFriendship.createdAt,
    };
  }

  async cancelRequest(receiverId: string, userId: string) {
    const friendship = await this.findFriendship(userId, receiverId);

    if (!friendship) {
      throw new AppError("Friendship not found", 404, "FRIENDSHIP_NOT_FOUND");
    }

    if (friendship.status !== "PENDING") {
      throw new AppError(
        "Only pending friendship requests can be cancelled",
        400,
        "INVALID_FRIENDSHIP_STATUS",
      );
    }

    if (friendship.senderId !== userId) {
      throw new AppError(
        "Only the sender can cancel the friendship request",
        403,
        "NOT_SENDER",
      );
    }

    await prisma.friendship.delete({ where: { id: friendship.id } });

    const io = getIO();
    if (io) {
      io.to(`user:${friendship.receiverId}`).emit("friendship:cancelled", { friendshipId: friendship.id });
    }

    return { message: "Friendship request cancelled" };
  }

  async rejectRequest(receiverId: string, userId: string) {
    const friendship = await this.findFriendship(userId, receiverId);

    if (!friendship) {
      throw new AppError("Friendship not found", 404, "FRIENDSHIP_NOT_FOUND");
    }

    if (friendship.status !== "PENDING") {
      throw new AppError(
        "Only pending friendship requests can be rejected",
        400,
        "INVALID_FRIENDSHIP_STATUS",
      );
    }

    if (friendship.receiverId !== userId) {
      throw new AppError(
        "Only the receiver can reject the friendship request",
        403,
        "NOT_RECEIVER",
      );
    }

    await prisma.friendship.delete({ where: { id: friendship.id } });

    const io = getIO();
    if (io) {
      io.to(`user:${friendship.senderId}`).emit("friendship:rejected", { friendshipId: friendship.id });
    }

    return { message: "Friendship request rejected" };
  }

  async removeFriend(receiverId: string, userId: string) {
    const friendship = await this.findFriendship(userId, receiverId);

    if (!friendship) {
      throw new AppError("Friendship not found", 404, "FRIENDSHIP_NOT_FOUND");
    }

    if (friendship.status !== "ACCEPTED") {
      throw new AppError(
        "Only accepted friendships can be removed",
        400,
        "INVALID_FRIENDSHIP_STATUS",
      );
    }

    await prisma.friendship.delete({ where: { id: friendship.id } });

    const io = getIO();
    if (io) {
      io.to(`user:${friendship.senderId}`).emit("friendship:removed", { friendshipId: friendship.id });
      io.to(`user:${friendship.receiverId}`).emit("friendship:removed", { friendshipId: friendship.id });
    }

    return { message: "Friendship removed" };
  }

  async unblockUser(receiverId: string, userId: string) {
    const friendship = await prisma.friendship.findUnique({
      where: {
        senderId_receiverId: { senderId: userId, receiverId },
      },
    });

    if (!friendship) {
      throw new AppError("Friendship not found", 404, "FRIENDSHIP_NOT_FOUND");
    }

    if (friendship.status !== "BLOCKED") {
      throw new AppError(
        "Only blocked users can be unblocked",
        400,
        "INVALID_FRIENDSHIP_STATUS",
      );
    }

    if (friendship.senderId !== userId) {
      throw new AppError(
        "Only the user who blocked can unblock",
        403,
        "NOT_BLOCKER",
      );
    }

    await prisma.friendship.delete({ where: { id: friendship.id } });

    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit("friendship:unblocked", { friendshipId: friendship.id });
    }

    return { message: "User unblocked" };
  }

  private static readonly userSelect = {
    select: { id: true, username: true, avatar: true },
  } as const;

  private static readonly friendshipInclude = {
    sender: { select: { id: true, username: true, avatar: true } },
    receiver: { select: { id: true, username: true, avatar: true } },
  } as const;

  private toFriendshipResponse(f: { id: string; status: string; createdAt: Date; sender: { id: string; username: string; avatar: string | null }; receiver: { id: string; username: string; avatar: string | null } }) {
    return { id: f.id, status: f.status, createdAt: f.createdAt, sender: f.sender, receiver: f.receiver };
  }

  async getFriends(userId: string) {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: "ACCEPTED",
      },
      include: {
        sender: FriendshipsService.userSelect,
        receiver: FriendshipsService.userSelect,
      },
      orderBy: { createdAt: "desc" },
    });

    return friendships.map((f) => ({
      id: f.id,
      status: f.status,
      createdAt: f.createdAt,
      sender: f.sender,
      receiver: f.receiver,
    }));
  }

  async getBlockedUsers(userId: string) {
    const blocked = await prisma.friendship.findMany({
      where: { senderId: userId, status: "BLOCKED" },
      include: {
        sender: FriendshipsService.userSelect,
        receiver: FriendshipsService.userSelect,
      },
      orderBy: { createdAt: "desc" },
    });

    return blocked.map((f) => ({
      id: f.id,
      status: f.status,
      createdAt: f.createdAt,
      sender: f.sender,
      receiver: f.receiver,
    }));
  }

  async getFriendRequests(userId: string) {
    const requests = await prisma.friendship.findMany({
      where: { receiverId: userId, status: "PENDING" },
      include: {
        sender: FriendshipsService.userSelect,
        receiver: FriendshipsService.userSelect,
      },
      orderBy: { createdAt: "desc" },
    });

    return requests.map((f) => ({
      id: f.id,
      status: f.status,
      createdAt: f.createdAt,
      sender: f.sender,
      receiver: f.receiver,
    }));
  }

  async getSentRequests(userId: string) {
    const sent = await prisma.friendship.findMany({
      where: { senderId: userId, status: "PENDING" },
      include: {
        sender: FriendshipsService.userSelect,
        receiver: FriendshipsService.userSelect,
      },
      orderBy: { createdAt: "desc" },
    });

    return sent.map((f) => ({
      id: f.id,
      status: f.status,
      createdAt: f.createdAt,
      sender: f.sender,
      receiver: f.receiver,
    }));
  }

  private findFriendship(userId: string, otherUserId: string) {
    return prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
    });
  }
}
