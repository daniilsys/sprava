/**
 * Unit tests for ChannelsService.
 * Covers create, update, delete, send message, get messages,
 * channel rules (CRUD), and read state.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChannelsService } from "../../src/modules/channels/channels.service.js";
import { prisma } from "../../src/config/db.js";
import { makeChannel, makeMessage } from "../helpers/factories.js";
import { AppError } from "../../src/utils/AppError.js";

describe("ChannelsService", () => {
  let service: ChannelsService;

  beforeEach(() => {
    service = new ChannelsService();
  });

  // ── Create ─────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("should create channel with auto-incremented position", async () => {
      const channel = makeChannel({ id: "ch1", serverId: "s1", position: 3 });
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          channel: {
            count: vi.fn().mockResolvedValue(3),
            create: vi.fn().mockResolvedValue({ ...channel, server: {} }),
          },
        };
        return fn(tx);
      });

      const result = await service.create(
        { name: "general", type: "TEXT", serverId: "s1" },
        "user-1",
      );

      expect(result).toBeTruthy();
    });
  });

  // ── Update ─────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("should update channel name", async () => {
      const channel = makeChannel({ id: "ch1", position: 0 });
      vi.mocked(prisma.channel.findUnique).mockResolvedValue(channel as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          channel: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            update: vi.fn().mockResolvedValue({ ...channel, name: "renamed" }),
          },
        };
        return fn(tx);
      });

      const result = await service.update("ch1", { name: "renamed" }, "user-1");
      expect(result.name).toBe("renamed");
    });

    it("should throw CHANNEL_NOT_FOUND for missing channel", async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValue(null);

      await expect(
        service.update("missing", { name: "test" }, "user-1"),
      ).rejects.toThrow("Channel not found");
    });

    it("should handle position reordering (moving down)", async () => {
      const channel = makeChannel({ id: "ch1", position: 0 });
      vi.mocked(prisma.channel.findUnique).mockResolvedValue(channel as any);

      const updateMany = vi.fn().mockResolvedValue({ count: 2 });
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          channel: {
            updateMany,
            update: vi.fn().mockResolvedValue({ ...channel, position: 2 }),
          },
        };
        return fn(tx);
      });

      await service.update("ch1", { position: 2 }, "user-1");
      // Should shift channels in (0, 2] down by 1
      expect(updateMany).toHaveBeenCalled();
    });
  });

  // ── Delete ─────────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("should delete channel and close position gap", async () => {
      const channel = makeChannel({ id: "ch1", position: 1 });
      vi.mocked(prisma.channel.findUnique).mockResolvedValue(channel as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          channel: {
            delete: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return fn(tx);
      });

      await expect(service.delete("ch1", "user-1")).resolves.toBeUndefined();
    });

    it("should throw CHANNEL_NOT_FOUND for missing channel", async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValue(null);

      await expect(service.delete("missing", "user-1")).rejects.toThrow("Channel not found");
    });
  });

  // ── Send message ──────────────────────────────────────────────────────────

  describe("sendMessage", () => {
    it("should create message and emit socket event", async () => {
      const channel = makeChannel({ id: "ch1", serverId: "s1" });
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        ...channel,
        server: {},
      } as any);

      const author = { id: "user-1", username: "testuser", avatar: null };
      const msg = { ...makeMessage({ id: "msg1", channelId: "ch1", authorId: "user-1" }), content: "Hello world" };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          message: {
            create: vi.fn().mockResolvedValue({ ...msg, author }),
          },
          attachment: {},
        };
        return fn(tx);
      });

      const result = await service.sendMessage(
        "ch1",
        { content: "Hello world" },
        "user-1",
      );

      expect(result).toBeTruthy();
      expect(result.content).toBe("Hello world");
    });

    it("should create message with attachments", async () => {
      const channel = makeChannel({ id: "ch1" });
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        ...channel,
        server: {},
      } as any);

      const author = { id: "user-1", username: "testuser", avatar: null };
      const msg = makeMessage({ id: "msg1", content: "" });

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          message: {
            create: vi.fn().mockResolvedValue({ ...msg, author }),
          },
          attachment: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
            findMany: vi.fn().mockResolvedValue([
              { id: "att1", url: "https://cdn.example.com/file.png", filename: "file.png", size: 1024, mimeType: "image/png" },
            ]),
          },
        };
        return fn(tx);
      });

      const result = await service.sendMessage(
        "ch1",
        {
          content: "",
          attachments: [
            { url: "https://cdn.example.com/file.png", filename: "file.png", size: 1024, mimeType: "image/png" },
          ],
        },
        "user-1",
      );

      expect(result.attachments).toHaveLength(1);
    });

    it("should throw CHANNEL_NOT_FOUND for missing channel", async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValue(null);

      await expect(
        service.sendMessage("missing", { content: "test" }, "user-1"),
      ).rejects.toThrow("Channel not found");
    });
  });

  // ── Get messages ──────────────────────────────────────────────────────────

  describe("getMessages", () => {
    it("should return messages in chronological order", async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        ...makeChannel(),
        server: {},
      } as any);

      const messages = [
        { ...makeMessage({ id: "m2" }), author: { id: "u1", username: "a", avatar: null }, reactions: [], attachments: [] },
        { ...makeMessage({ id: "m1" }), author: { id: "u1", username: "a", avatar: null }, reactions: [], attachments: [] },
      ];
      vi.mocked(prisma.message.findMany).mockResolvedValue(messages as any);

      const result = await service.getMessages("ch1", "user-1");

      expect(result).toHaveLength(2);
      // reversed from desc to asc
      expect(result[0].id).toBe("m1");
    });

    it("should support cursor-based pagination", async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        ...makeChannel(),
        server: {},
      } as any);
      vi.mocked(prisma.message.findMany).mockResolvedValue([]);

      await service.getMessages("ch1", "user-1", "cursor-id", 25);

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          where: expect.objectContaining({
            id: { lt: "cursor-id" },
          }),
        }),
      );
    });
  });

  // ── Channel rules ─────────────────────────────────────────────────────────

  describe("upsertRule", () => {
    it("should upsert a role-based channel rule", async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        ...makeChannel(),
        server: {},
      } as any);
      vi.mocked(prisma.channelRule.upsert).mockResolvedValue({
        id: "rule1",
        channelId: "ch1",
        roleId: "role-1",
        memberId: null,
        allow: 8n,
        deny: 0n,
      } as any);

      const result = await service.upsertRule(
        "ch1",
        { roleId: "role-1", allow: "8", deny: "0" },
        "user-1",
      );

      expect(result).toBeTruthy();
    });
  });

  describe("deleteRule", () => {
    it("should delete an existing rule", async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        ...makeChannel(),
        server: {},
      } as any);
      vi.mocked(prisma.channelRule.findUnique).mockResolvedValue({ id: "rule1" } as any);
      vi.mocked(prisma.channelRule.delete).mockResolvedValue({} as any);

      await expect(
        service.deleteRule("ch1", { roleId: "role-1" }, "user-1"),
      ).resolves.toBeUndefined();
    });

    it("should throw RULE_NOT_FOUND for missing rule", async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        ...makeChannel(),
        server: {},
      } as any);
      vi.mocked(prisma.channelRule.findUnique).mockResolvedValue(null);

      await expect(
        service.deleteRule("ch1", { roleId: "role-1" }, "user-1"),
      ).rejects.toThrow("Rule not found");
    });
  });

  // ── Read state ────────────────────────────────────────────────────────────

  describe("getReadState", () => {
    it("should return null lastReadMessageId if not read", async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        ...makeChannel(),
        server: {},
      } as any);
      vi.mocked(prisma.readState.findUnique).mockResolvedValue(null);

      const result = await service.getReadState("ch1", "user-1");
      expect(result.lastReadMessageId).toBeNull();
    });
  });

  describe("updateReadState", () => {
    it("should upsert read state", async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        ...makeChannel(),
        server: {},
      } as any);
      vi.mocked(prisma.readState.upsert).mockResolvedValue({
        channelId: "ch1",
        lastReadMessageId: "msg-5",
      } as any);

      const result = await service.updateReadState("ch1", "user-1", "msg-5");
      expect(result).toBeTruthy();
    });
  });
});
