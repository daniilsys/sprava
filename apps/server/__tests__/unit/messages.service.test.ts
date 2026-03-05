/**
 * Unit tests for MessagesService.
 * Covers edit, delete (soft), add/remove reactions, reply.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessagesService } from "../../src/modules/messages/messages.service.js";
import { prisma } from "../../src/config/db.js";
import { makeMessage } from "../helpers/factories.js";

describe("MessagesService", () => {
  let service: MessagesService;

  beforeEach(() => {
    service = new MessagesService();
  });

  // ── Edit message ──────────────────────────────────────────────────────────

  describe("editMessage", () => {
    it("should edit message content if author matches", async () => {
      const msg = makeMessage({ id: "m1", authorId: "user-1", channelId: "ch1" });
      vi.mocked(prisma.message.findUnique).mockResolvedValue(msg as any);
      vi.mocked(prisma.message.update).mockResolvedValue({
        ...msg,
        content: "edited",
        editedAt: new Date(),
      } as any);

      const result = await service.editMessage({ content: "edited" }, "m1", "user-1");

      expect(result.content).toBe("edited");
      expect(result.editedAt).toBeTruthy();
    });

    it("should throw MESSAGE_NOT_FOUND if message doesn't exist", async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValue(null);

      await expect(
        service.editMessage({ content: "test" }, "missing", "user-1"),
      ).rejects.toThrow("Message not found");
    });

    it("should throw MESSAGE_DELETED if message was soft-deleted", async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValue(
        makeMessage({ deletedAt: new Date() }) as any,
      );

      await expect(
        service.editMessage({ content: "test" }, "m1", "user-1"),
      ).rejects.toThrow("Message has been deleted");
    });

    it("should throw NOT_AUTHOR if user is not the author", async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValue(
        makeMessage({ authorId: "other-user" }) as any,
      );

      await expect(
        service.editMessage({ content: "test" }, "m1", "user-1"),
      ).rejects.toThrow("You don't have permission to edit this message");
    });
  });

  // ── Delete message ────────────────────────────────────────────────────────

  describe("deleteMessage", () => {
    it("should soft-delete a message (sets deletedAt)", async () => {
      const msg = makeMessage({ authorId: "user-1", channelId: "ch1" });
      vi.mocked(prisma.message.findUnique).mockResolvedValue(msg as any);
      vi.mocked(prisma.message.update).mockResolvedValue({} as any);

      await expect(service.deleteMessage("m1", "user-1")).resolves.toBeUndefined();

      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });

    it("should throw if message doesn't exist or already deleted", async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValue(null);

      await expect(service.deleteMessage("missing", "user-1")).rejects.toThrow(
        "Message not found",
      );
    });

    it("should throw NOT_AUTHOR if user is not the author", async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValue(
        makeMessage({ authorId: "other-user" }) as any,
      );

      await expect(service.deleteMessage("m1", "user-1")).rejects.toThrow(
        "You don't have permission to delete this message",
      );
    });
  });

  // ── Add reaction ──────────────────────────────────────────────────────────

  describe("addReaction", () => {
    it("should add reaction to channel message", async () => {
      const msg = makeMessage({ channelId: "ch1", dmConversationId: null });
      vi.mocked(prisma.message.findUnique).mockResolvedValue({
        ...msg,
        channel: { id: "ch1", serverId: "s1" },
        dmConversation: null,
      } as any);
      // The service does a second channel.findUnique to get serverId
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        id: "ch1",
        serverId: "s1",
        server: {},
      } as any);
      vi.mocked(prisma.serverMember.findFirst).mockResolvedValue({ userId: "user-1" } as any);
      vi.mocked(prisma.reaction.findFirst).mockResolvedValue(null); // no duplicate
      vi.mocked(prisma.reaction.create).mockResolvedValue({
        id: "r1",
        emoji: "👍",
        userId: "user-1",
        messageId: "m1",
      } as any);

      await expect(service.addReaction("m1", "user-1", "👍")).resolves.toBeUndefined();
    });

    it("should throw INVALID_EMOJI for non-emoji string", async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValue({
        ...makeMessage(),
        channel: {},
        dmConversation: null,
      } as any);

      await expect(service.addReaction("m1", "user-1", "not-emoji")).rejects.toThrow(
        "Invalid emoji",
      );
    });

    it("should throw REACTION_ALREADY_EXISTS on duplicate reaction", async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValue({
        ...makeMessage({ channelId: "ch1" }),
        channel: { id: "ch1", serverId: "s1" },
        dmConversation: null,
      } as any);
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        id: "ch1",
        serverId: "s1",
        server: {},
      } as any);
      vi.mocked(prisma.serverMember.findFirst).mockResolvedValue({ userId: "user-1" } as any);
      vi.mocked(prisma.reaction.findFirst).mockResolvedValue({
        id: "existing",
      } as any);

      await expect(service.addReaction("m1", "user-1", "👍")).rejects.toThrow(
        "You have already reacted with this emoji",
      );
    });

    it("should throw MESSAGE_NOT_FOUND for deleted message", async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValue(null);

      await expect(service.addReaction("missing", "user-1", "👍")).rejects.toThrow(
        "Message not found",
      );
    });
  });

  // ── Remove reaction ───────────────────────────────────────────────────────

  describe("removeReaction", () => {
    it("should remove existing reaction", async () => {
      vi.mocked(prisma.reaction.findFirst).mockResolvedValue({
        id: "r1",
        emoji: "👍",
        userId: "user-1",
        messageId: "m1",
        message: { channelId: "ch1", dmConversationId: null },
      } as any);
      vi.mocked(prisma.reaction.delete).mockResolvedValue({} as any);

      await expect(service.removeReaction("m1", "user-1", "👍")).resolves.toBeUndefined();
    });

    it("should throw REACTION_NOT_FOUND if reaction doesn't exist", async () => {
      vi.mocked(prisma.reaction.findFirst).mockResolvedValue(null);

      await expect(service.removeReaction("m1", "user-1", "👍")).rejects.toThrow(
        "Reaction not found",
      );
    });
  });

  // ── Reply ─────────────────────────────────────────────────────────────────

  describe("replyMessage", () => {
    it("should create reply linking to parent message", async () => {
      const parent = makeMessage({ id: "parent", channelId: "ch1", authorId: "user-2" });
      vi.mocked(prisma.message.findUnique).mockResolvedValue({
        ...parent,
        channel: { serverId: "s1" },
      } as any);

      const reply = makeMessage({ id: "reply1", replyToId: "parent" });
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          message: {
            create: vi.fn().mockResolvedValue({
              ...reply,
              author: { id: "user-1", username: "replier", avatar: null },
            }),
          },
          attachment: {},
        };
        return fn(tx);
      });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-2",
        username: "original",
        avatar: null,
      } as any);

      const result = await service.replyMessage(
        "parent",
        { content: "reply content" },
        "user-1",
      );

      expect(result).toBeTruthy();
      expect(result.replyToId).toBe("parent");
    });

    it("should throw MESSAGE_NOT_FOUND for deleted parent", async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValue(
        makeMessage({ deletedAt: new Date() }) as any,
      );

      await expect(
        service.replyMessage("deleted-parent", { content: "reply" }, "user-1"),
      ).rejects.toThrow("Message not found");
    });
  });
});
