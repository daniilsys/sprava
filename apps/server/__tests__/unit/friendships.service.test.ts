/**
 * Unit tests for FriendshipsService.
 * Covers send request, accept, block, cancel, reject, remove, unblock, list queries.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FriendshipsService } from "../../src/modules/friendships/friendships.service.js";
import { prisma } from "../../src/config/db.js";
import { makeFriendship, makeUser } from "../helpers/factories.js";

describe("FriendshipsService", () => {
  let service: FriendshipsService;

  beforeEach(() => {
    service = new FriendshipsService();
  });

  // ── Send request ──────────────────────────────────────────────────────────

  describe("sendRequest", () => {
    it("should create a PENDING friendship", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        makeUser({ id: "user-2", username: "target" }) as any,
      );
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.friendship.create).mockResolvedValue(
        makeFriendship({ senderId: "user-1", receiverId: "user-2", status: "PENDING" }) as any,
      );

      const result = await service.sendRequest("target", "user-1");

      expect(result.receiverId).toBe("user-2");
      expect(result.status).toBe("PENDING");
    });

    it("should throw USER_NOT_FOUND if receiver doesn't exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.sendRequest("nobody", "user-1")).rejects.toThrow(
        "Cannot find this user",
      );
    });

    it("should throw PENDING_FRIENDSHIP_EXISTS on duplicate pending", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as any);
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ status: "PENDING" }) as any,
      );

      await expect(service.sendRequest("target", "user-1")).rejects.toThrow(
        "A pending friendship request already exists",
      );
    });

    it("should throw ALREADY_FRIENDS if already accepted", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as any);
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ status: "ACCEPTED" }) as any,
      );

      await expect(service.sendRequest("target", "user-1")).rejects.toThrow(
        "You are already friends with this user",
      );
    });

    it("should throw USER_NOT_FOUND if target is blocked", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as any);
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ status: "BLOCKED" }) as any,
      );

      await expect(service.sendRequest("target", "user-1")).rejects.toThrow(
        "Cannot find this user",
      );
    });
  });

  // ── Accept ────────────────────────────────────────────────────────────────

  describe("update (ACCEPTED)", () => {
    it("should accept pending request as receiver", async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ senderId: "user-2", receiverId: "user-1", status: "PENDING" }) as any,
      );
      vi.mocked(prisma.friendship.update).mockResolvedValue(
        makeFriendship({ status: "ACCEPTED" }) as any,
      );

      const result = await service.update(
        { status: "ACCEPTED", receiverId: "user-2" },
        "user-1",
      );

      expect(result.status).toBe("ACCEPTED");
    });

    it("should throw NOT_RECEIVER if sender tries to accept", async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ senderId: "user-1", receiverId: "user-2", status: "PENDING" }) as any,
      );

      await expect(
        service.update({ status: "ACCEPTED", receiverId: "user-2" }, "user-1"),
      ).rejects.toThrow("Only the receiver can accept the friendship");
    });

    it("should throw ALREADY_ACCEPTED_FRIENDSHIP if already accepted", async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ status: "ACCEPTED" }) as any,
      );

      await expect(
        service.update({ status: "ACCEPTED", receiverId: "user-2" }, "user-1"),
      ).rejects.toThrow("Cannot accept an already accepted friendship");
    });
  });

  // ── Block ─────────────────────────────────────────────────────────────────

  describe("update (BLOCKED)", () => {
    it("should block an existing relationship", async () => {
      vi.mocked(prisma.friendship.findUnique).mockResolvedValue(
        makeFriendship({ senderId: "user-1", status: "ACCEPTED" }) as any,
      );
      vi.mocked(prisma.friendship.update).mockResolvedValue({} as any);

      const result = await service.update(
        { status: "BLOCKED", receiverId: "user-2" },
        "user-1",
      );

      expect(result.status).toBe("BLOCKED");
    });

    it("should create new BLOCKED record if none exists", async () => {
      vi.mocked(prisma.friendship.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.friendship.create).mockResolvedValue({} as any);

      const result = await service.update(
        { status: "BLOCKED", receiverId: "user-2" },
        "user-1",
      );

      expect(result.status).toBe("BLOCKED");
    });
  });

  // ── Cancel ────────────────────────────────────────────────────────────────

  describe("cancelRequest", () => {
    it("should cancel own pending request", async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ senderId: "user-1", status: "PENDING" }) as any,
      );
      vi.mocked(prisma.friendship.delete).mockResolvedValue({} as any);

      const result = await service.cancelRequest("user-2", "user-1");
      expect(result.message).toContain("cancelled");
    });

    it("should throw NOT_SENDER if receiver tries to cancel", async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ senderId: "user-2", receiverId: "user-1", status: "PENDING" }) as any,
      );

      await expect(service.cancelRequest("user-2", "user-1")).rejects.toThrow(
        "Only the sender can cancel",
      );
    });
  });

  // ── Reject ────────────────────────────────────────────────────────────────

  describe("rejectRequest", () => {
    it("should reject incoming request as receiver", async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ senderId: "user-2", receiverId: "user-1", status: "PENDING" }) as any,
      );
      vi.mocked(prisma.friendship.delete).mockResolvedValue({} as any);

      const result = await service.rejectRequest("user-2", "user-1");
      expect(result.message).toContain("rejected");
    });

    it("should throw NOT_RECEIVER if sender tries to reject", async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ senderId: "user-1", receiverId: "user-2", status: "PENDING" }) as any,
      );

      await expect(service.rejectRequest("user-2", "user-1")).rejects.toThrow(
        "Only the receiver can reject",
      );
    });
  });

  // ── Remove friend ─────────────────────────────────────────────────────────

  describe("removeFriend", () => {
    it("should remove accepted friendship", async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ status: "ACCEPTED" }) as any,
      );
      vi.mocked(prisma.friendship.delete).mockResolvedValue({} as any);

      const result = await service.removeFriend("user-2", "user-1");
      expect(result.message).toContain("removed");
    });

    it("should throw INVALID_FRIENDSHIP_STATUS for non-accepted", async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(
        makeFriendship({ status: "PENDING" }) as any,
      );

      await expect(service.removeFriend("user-2", "user-1")).rejects.toThrow(
        "Only accepted friendships can be removed",
      );
    });
  });

  // ── Unblock ───────────────────────────────────────────────────────────────

  describe("unblockUser", () => {
    it("should unblock a blocked user", async () => {
      vi.mocked(prisma.friendship.findUnique).mockResolvedValue(
        makeFriendship({ senderId: "user-1", status: "BLOCKED" }) as any,
      );
      vi.mocked(prisma.friendship.delete).mockResolvedValue({} as any);

      const result = await service.unblockUser("user-2", "user-1");
      expect(result.message).toContain("unblocked");
    });

    it("should throw if friendship is not blocked", async () => {
      vi.mocked(prisma.friendship.findUnique).mockResolvedValue(
        makeFriendship({ senderId: "user-1", status: "ACCEPTED" }) as any,
      );

      await expect(service.unblockUser("user-2", "user-1")).rejects.toThrow(
        "Only blocked users can be unblocked",
      );
    });
  });

  // ── List queries ──────────────────────────────────────────────────────────

  describe("getFriends", () => {
    it("should return friends with correct friendId mapping", async () => {
      vi.mocked(prisma.friendship.findMany).mockResolvedValue([
        makeFriendship({ senderId: "user-1", receiverId: "user-2", status: "ACCEPTED" }),
        makeFriendship({ senderId: "user-3", receiverId: "user-1", status: "ACCEPTED" }),
      ] as any);

      const result = await service.getFriends("user-1");

      expect(result).toHaveLength(2);
      expect(result[0].friendId).toBe("user-2");
      expect(result[1].friendId).toBe("user-3");
    });
  });

  describe("getBlockedUsers", () => {
    it("should return only users blocked by me", async () => {
      vi.mocked(prisma.friendship.findMany).mockResolvedValue([
        makeFriendship({ senderId: "user-1", receiverId: "user-5", status: "BLOCKED" }),
      ] as any);

      const result = await service.getBlockedUsers("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-5");
    });
  });
});
