import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import type { UpdateAccountDto, UpdateProfileDto } from "./users.schema.js";
import {
  toUserSummary,
  toUserResponse,
  toProfileResponse,
  toSettingsResponse,
} from "./users.mapper.js";
import { deleteSpacesObject } from "../../config/storage.js";

export class UsersService {
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, settings: true },
    });

    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    return toUserResponse(user);
  }

  async updateAccount(userId: string, dto: UpdateAccountDto) {
    if (dto.username) {
      const existing = await prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existing && existing.id !== userId)
        throw new AppError("Username already taken", 400, "USERNAME_TAKEN");
    }

    // Fetch current avatar before updating so we can delete the old one from Spaces
    let oldAvatar: string | null = null;
    if (dto.avatar !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatar: true },
      });
      oldAvatar = current?.avatar ?? null;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.username !== undefined ? { username: dto.username } : {}),
        ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
      },
    });

    // Delete old avatar from Spaces after a successful DB update
    if (oldAvatar && oldAvatar !== dto.avatar) {
      deleteSpacesObject(oldAvatar).catch(() => {});
    }

    return { id: user.id, username: user.username, email: user.email, avatar: user.avatar };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.website !== undefined ? { website: dto.website } : {}),
      },
      create: {
        userId,
        bio: dto.bio,
        location: dto.location,
        website: dto.website,
      },
    });

    return toProfileResponse(profile);
  }

  async getByUsername(username: string, viewerId: string) {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { profile: true, settings: true },
    });

    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const isFriend =
      user.id === viewerId
        ? true
        : !!(await prisma.friendship.findFirst({
            where: {
              status: "ACCEPTED",
              OR: [
                { senderId: viewerId, receiverId: user.id },
                { senderId: user.id, receiverId: viewerId },
              ],
            },
          }));

    const settings = user.settings;

    const isVisible = (level: string) => {
      if (level === "PUBLIC") return true;
      if (level === "FRIENDS_ONLY") return isFriend;
      return false; // NOBODY
    };

    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      createdAt: user.createdAt,
      email: settings && isVisible(settings.showEmail) ? user.email : undefined,
      profile: user.profile
        ? {
            bio: user.profile.bio,
            location:
              settings && isVisible(settings.showLocation)
                ? user.profile.location
                : undefined,
            website:
              settings && isVisible(settings.showWebsite)
                ? user.profile.website
                : undefined,
          }
        : null,
    };
  }

  async search(query: string, viewerId: string) {
    const users = await prisma.user.findMany({
      where: {
        username: { contains: query, mode: "insensitive" },
        id: { not: viewerId },
      },
      select: { id: true, username: true, avatar: true },
      take: 20,
    });

    return users.map(toUserSummary);
  }
}
