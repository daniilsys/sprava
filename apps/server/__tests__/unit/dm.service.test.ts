/**
 * Unit tests for DmService.
 * Covers create (1-1 and group), send message, get conversations,
 * update, leave, add/remove participants, read state.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DmService } from "../../src/modules/dm/dm.service.js";
import { prisma } from "../../src/config/db.js";
import { makeDm, makeMessage } from "../helpers/factories.js";

describe("DmService", () => {
  let service: DmService;

  beforeEach(() => {
    service = new DmService();
  });

  // ── Create 1-1 DM ────────────────────────────────────────────────────────

  describe("create (1-1)", () => {
    it("should create private DM when users are friends", async () => {
      // friendship exists
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue({ id: "f1" } as any);
      vi.mocked(prisma.server.findFirst).mockResolvedValue(null);
      // no existing DM
      vi.mocked(prisma.dmConversation.findFirst).mockResolvedValue(null);

      const dm = makeDm({ id: "dm1", type: "PRIVATE" });
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          dmConversation: { create: vi.fn().mockResolvedValue(dm) },
          dmParticipant: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.create(
        { participantIds: ["user-1", "user-2"] },
        "user-1",
      );

      expect(result).toBeTruthy();
    });

    it("should return existing DM if one already exists", async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue({ id: "f1" } as any);
      vi.mocked(prisma.server.findFirst).mockResolvedValue(null);

      const existing = {
        ...makeDm({ id: "existing-dm" }),
        participants: [{ userId: "user-1" }, { userId: "user-2" }],
      };
      vi.mocked(prisma.dmConversation.findFirst).mockResolvedValue(existing as any);

      const result = await service.create(
        { participantIds: ["user-1", "user-2"] },
        "user-1",
      );

      expect(result.id).toBe("existing-dm");
    });

    it("should throw NO_DM_PERMISSION if not friends and no common server", async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.server.findFirst).mockResolvedValue(null);

      await expect(
        service.create({ participantIds: ["user-1", "user-2"] }, "user-1"),
      ).rejects.toThrow("You must be friends or share a server to create a DM");
    });

    it("should throw INVALID_DM_PARTICIPANTS for self-DM", async () => {
      await expect(
        service.create({ participantIds: ["user-1", "user-1"] }, "user-1"),
      ).rejects.toThrow("You cannot create a DM with yourself");
    });
  });

  // ── Create group DM ───────────────────────────────────────────────────────

  describe("create (group)", () => {
    it("should create group DM when all participants are friends", async () => {
      // 2 friendships match 2 other participants
      vi.mocked(prisma.friendship.findMany).mockResolvedValue([
        { senderId: "user-1", receiverId: "user-2" },
        { senderId: "user-3", receiverId: "user-1" },
      ] as any);

      const dm = makeDm({ id: "gdm1", type: "GROUP", ownerId: "user-1" });
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          dmConversation: { create: vi.fn().mockResolvedValue(dm) },
          dmParticipant: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.create(
        { participantIds: ["user-1", "user-2", "user-3"] },
        "user-1",
      );

      expect(result).toBeTruthy();
    });

    it("should throw NOT_ALL_FRIENDS if not all are friends", async () => {
      // Only 1 friendship, but need 2
      vi.mocked(prisma.friendship.findMany).mockResolvedValue([
        { senderId: "user-1", receiverId: "user-2" },
      ] as any);

      await expect(
        service.create(
          { participantIds: ["user-1", "user-2", "user-3"] },
          "user-1",
        ),
      ).rejects.toThrow("You must be friends with all participants");
    });
  });

  // ── Send DM message ───────────────────────────────────────────────────────

  describe("sendMessage", () => {
    it("should send message in DM", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue({
        ...makeDm(),
        participants: [{ userId: "user-1" }, { userId: "user-2" }],
      } as any);

      const msg = makeMessage({ dmConversationId: "dm1" });
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          message: {
            create: vi.fn().mockResolvedValue({
              ...msg,
              author: { id: "user-1", username: "test", avatar: null },
            }),
          },
          attachment: {},
        };
        return fn(tx);
      });

      const result = await service.sendMessage("dm1", { content: "Hello" }, "user-1");
      expect(result).toBeTruthy();
    });

    it("should throw NOT_DM_PARTICIPANT if user is not a participant", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue({
        ...makeDm(),
        participants: [{ userId: "user-2" }, { userId: "user-3" }],
      } as any);

      await expect(
        service.sendMessage("dm1", { content: "Hello" }, "user-1"),
      ).rejects.toThrow("You are not a participant of this DM");
    });

    it("should throw DM_NOT_FOUND for missing DM", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue(null);

      await expect(
        service.sendMessage("missing", { content: "test" }, "user-1"),
      ).rejects.toThrow("DM not found");
    });
  });

  // ── Update ─────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("should update group DM name by owner", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue(
        makeDm({ type: "GROUP", ownerId: "user-1" }) as any,
      );
      vi.mocked(prisma.dmConversation.update).mockResolvedValue(
        makeDm({ name: "New Name" }) as any,
      );

      const result = await service.update("dm1", { name: "New Name" }, "user-1");
      expect(result).toBeTruthy();
    });

    it("should throw NOT_DM_OWNER if non-owner tries to update", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue(
        makeDm({ type: "GROUP", ownerId: "user-1" }) as any,
      );

      await expect(
        service.update("dm1", { name: "test" }, "user-2"),
      ).rejects.toThrow("Only the DM owner can update the DM");
    });
  });

  // ── Leave group ───────────────────────────────────────────────────────────

  describe("leaveGroup", () => {
    it("should transfer ownership if owner leaves", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue({
        ...makeDm({ type: "GROUP", ownerId: "user-1" }),
        participants: [{ userId: "user-1" }, { userId: "user-2" }],
      } as any);
      vi.mocked(prisma.dmParticipant.deleteMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.dmConversation.update).mockResolvedValue({} as any);

      const result = await service.leaveGroup("dm1", "user-1");
      expect(result.message).toContain("Left");
      expect(prisma.dmConversation.update).toHaveBeenCalled();
    });

    it("should delete group if last participant leaves", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue({
        ...makeDm({ type: "GROUP", ownerId: "user-1" }),
        participants: [{ userId: "user-1" }],
      } as any);
      vi.mocked(prisma.dmParticipant.deleteMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.dmConversation.delete).mockResolvedValue({} as any);

      await service.leaveGroup("dm1", "user-1");
      expect(prisma.dmConversation.delete).toHaveBeenCalled();
    });
  });

  // ── Add participant ───────────────────────────────────────────────────────

  describe("addParticipant", () => {
    it("should add participant to group DM", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue({
        ...makeDm({ type: "GROUP", ownerId: "user-1" }),
        participants: [{ userId: "user-1" }, { userId: "user-2" }],
      } as any);
      vi.mocked(prisma.dmParticipant.create).mockResolvedValue({} as any);

      const result = await service.addParticipant("dm1", "user-3", "user-1");
      expect(result.participantId).toBe("user-3");
    });

    it("should enforce 10 participant limit", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue({
        ...makeDm({ type: "GROUP", ownerId: "user-1" }),
        participants: Array.from({ length: 10 }, (_, i) => ({ userId: `u${i}` })),
      } as any);

      await expect(
        service.addParticipant("dm1", "user-11", "user-1"),
      ).rejects.toThrow("DM cannot have more than 10 participants");
    });

    it("should throw ALREADY_PARTICIPANT for duplicate", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue({
        ...makeDm({ type: "GROUP", ownerId: "user-1" }),
        participants: [{ userId: "user-1" }, { userId: "user-2" }],
      } as any);

      await expect(
        service.addParticipant("dm1", "user-2", "user-1"),
      ).rejects.toThrow("User is already a participant of this DM");
    });
  });

  // ── Remove participant ────────────────────────────────────────────────────

  describe("removeParticipant", () => {
    it("should remove participant from group DM", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue({
        ...makeDm({ type: "GROUP", ownerId: "user-1" }),
        participants: [{ userId: "user-1" }, { userId: "user-2" }],
      } as any);
      vi.mocked(prisma.dmParticipant.deleteMany).mockResolvedValue({ count: 1 });

      const result = await service.removeParticipant("dm1", "user-2", "user-1");
      expect(result.message).toContain("removed");
    });

    it("should throw NOT_DM_OWNER if non-owner tries", async () => {
      vi.mocked(prisma.dmConversation.findUnique).mockResolvedValue({
        ...makeDm({ type: "GROUP", ownerId: "user-1" }),
        participants: [{ userId: "user-1" }, { userId: "user-2" }],
      } as any);

      await expect(
        service.removeParticipant("dm1", "user-1", "user-2"),
      ).rejects.toThrow("Only the DM owner can remove participants");
    });
  });

  // ── Read state ────────────────────────────────────────────────────────────

  describe("read", () => {
    it("should upsert read state", async () => {
      vi.mocked(prisma.readState.upsert).mockResolvedValue({
        dmConversationId: "dm1",
        lastReadMessageId: "msg-5",
      } as any);

      const result = await service.read("dm1", "user-1", "msg-5");
      expect(result).toBeTruthy();
    });
  });
});
