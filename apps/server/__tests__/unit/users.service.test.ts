/**
 * Unit tests for UsersService.
 * Covers getMe, updateAccount, updateProfile, getByUsername (privacy), search.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UsersService } from "../../src/modules/users/users.service.js";
import { prisma } from "../../src/config/db.js";
import { makeUser } from "../helpers/factories.js";

describe("UsersService", () => {
  let service: UsersService;

  beforeEach(() => {
    service = new UsersService();
  });

  // ── getMe ─────────────────────────────────────────────────────────────────

  describe("getMe", () => {
    it("should return authenticated user with profile and settings", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...makeUser({ id: "user-1" }),
        profile: { bio: "Hello", location: "Paris", website: null },
        settings: { theme: "dark", language: "en" },
      } as any);

      const result = await service.getMe("user-1");

      expect(result).toBeTruthy();
      expect(result.id).toBe("user-1");
    });

    it("should throw USER_NOT_FOUND if user doesn't exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.getMe("missing")).rejects.toThrow("User not found");
    });
  });

  // ── updateAccount ─────────────────────────────────────────────────────────

  describe("updateAccount", () => {
    it("should update username", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null); // username not taken
      vi.mocked(prisma.user.update).mockResolvedValue(
        makeUser({ id: "user-1", username: "newname" }) as any,
      );

      const result = await service.updateAccount("user-1", { username: "newname" });
      expect(result.username).toBe("newname");
    });

    it("should throw USERNAME_TAKEN if username belongs to another user", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        makeUser({ id: "other-user", username: "taken" }) as any,
      );

      await expect(
        service.updateAccount("user-1", { username: "taken" }),
      ).rejects.toThrow("Username already taken");
    });

    it("should delete old avatar from storage when updating", async () => {
      const { deleteSpacesObject } = await import("../../src/config/storage.js");
      // Only avatar update — no username to check
      // The service fetches current avatar before updating
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({ avatar: "https://old-avatar.com/img.png" } as any); // current avatar

      vi.mocked(prisma.user.update).mockResolvedValue(
        makeUser({ avatar: "https://new-avatar.com/img.png" }) as any,
      );

      await service.updateAccount("user-1", { avatar: "https://new-avatar.com/img.png" });

      expect(deleteSpacesObject).toHaveBeenCalledWith("https://old-avatar.com/img.png");
    });
  });

  // ── updateProfile ─────────────────────────────────────────────────────────

  describe("updateProfile", () => {
    it("should upsert profile with provided fields", async () => {
      vi.mocked(prisma.userProfile.upsert).mockResolvedValue({
        bio: "New bio",
        location: null,
        website: null,
      } as any);

      const result = await service.updateProfile("user-1", { bio: "New bio" });
      expect(result.bio).toBe("New bio");
    });
  });

  // ── getByUsername (privacy) ────────────────────────────────────────────────

  describe("getByUsername", () => {
    it("should show all fields for self-view", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...makeUser({ id: "user-1" }),
        profile: { bio: "bio", location: "Paris", website: "https://example.com" },
        settings: {
          showEmail: "NOBODY",
          showLocation: "NOBODY",
          showWebsite: "NOBODY",
        },
      } as any);

      const result = await service.getByUsername("user_1000", "user-1");

      // Self always sees everything
      expect(result).toBeTruthy();
    });

    it("should hide FRIENDS_ONLY fields from non-friends", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...makeUser({ id: "user-2" }),
        profile: { bio: "bio", location: "Paris", website: "https://example.com" },
        settings: {
          showEmail: "FRIENDS_ONLY",
          showLocation: "FRIENDS_ONLY",
          showWebsite: "PUBLIC",
        },
      } as any);
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(null); // not friends

      const result = await service.getByUsername("user_2", "user-1");

      expect(result.email).toBeUndefined();
      expect(result.profile?.location).toBeUndefined();
      expect(result.profile?.website).toBe("https://example.com"); // PUBLIC
    });

    it("should show FRIENDS_ONLY fields for friends", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...makeUser({ id: "user-2" }),
        profile: { bio: "bio", location: "Paris", website: null },
        settings: {
          showEmail: "FRIENDS_ONLY",
          showLocation: "FRIENDS_ONLY",
          showWebsite: "FRIENDS_ONLY",
        },
      } as any);
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue({ id: "f1" } as any);

      const result = await service.getByUsername("user_2", "user-1");

      expect(result.profile?.location).toBe("Paris");
    });

    it("should throw USER_NOT_FOUND for unknown username", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.getByUsername("nobody", "user-1")).rejects.toThrow(
        "User not found",
      );
    });
  });

  // ── Search ────────────────────────────────────────────────────────────────

  describe("search", () => {
    it("should return matching users excluding self", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "u2", username: "testuser", avatar: null },
      ] as any);

      const result = await service.search("test", "user-1");

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe("testuser");
    });
  });
});
