import { prisma } from "../../config/db.js";
import type { UpdateFriendshipDto } from "./friendships.schema.js";
import { AppError } from "../../utils/AppError.js";
import { generateId } from "../../utils/snowflake.js";

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
        await prisma.friendship.update({
          where: { id: relationship.id },
          data: { status: "BLOCKED" },
        });

        return {
          receiverId: dto.receiverId,
          status: "BLOCKED",
          createdAt: relationship.createdAt,
        };
      } else {
        await prisma.friendship.create({
          data: {
            id: generateId(),
            senderId: userId,
            receiverId: dto.receiverId,
            status: "BLOCKED",
          },
        });

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
    });

    return {
      receiverId: updatedFriendship.receiverId,
      status: updatedFriendship.status,
      createdAt: updatedFriendship.createdAt,
    };
  }

  async sendRequest(receiverUsername: string, userId: string) {
    const receiver = await prisma.user.findUnique({
      where: { username: receiverUsername },
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
    });

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

    return { message: "User unblocked" };
  }

  async getFriends(userId: string) {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: "ACCEPTED",
      },
    });

    return friendships.map((friendship) => {
      const friendId =
        friendship.senderId === userId
          ? friendship.receiverId
          : friendship.senderId;
      return {
        friendId,
        createdAt: friendship.createdAt,
        status: friendship.status,
      };
    });
  }

  async getBlockedUsers(userId: string) {
    const blockedRelationships = await prisma.friendship.findMany({
      where: {
        senderId: userId,
        status: "BLOCKED",
      },
    });

    return blockedRelationships.map((relationship) => ({
      userId: relationship.receiverId,
      createdAt: relationship.createdAt,
      status: relationship.status,
    }));
  }

  async getFriendRequests(userId: string) {
    const friendRequests = await prisma.friendship.findMany({
      where: {
        receiverId: userId,
        status: "PENDING",
      },
    });

    return friendRequests.map((request) => ({
      senderId: request.senderId,
      createdAt: request.createdAt,
      status: request.status,
    }));
  }

  async getSentRequests(userId: string) {
    const sentRequests = await prisma.friendship.findMany({
      where: {
        senderId: userId,
        status: "PENDING",
      },
    });

    return sentRequests.map((request) => ({
      receiverId: request.receiverId,
      createdAt: request.createdAt,
      status: request.status,
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
