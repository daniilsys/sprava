/**
 * Unit tests for ServersService.
 * Covers CRUD, join/leave, kick/ban/unban, ownership transfer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServersService } from "../../src/modules/servers/servers.service.js";
import { prisma } from "../../src/config/db.js";
import { makeServer, makeMember, makeRole } from "../helpers/factories.js";
import { AppError } from "../../src/utils/AppError.js";
import { checkPermission, checkRoleHierarchy } from "../../src/utils/checkPermission.js";

describe("ServersService", () => {
  let service: ServersService;

  beforeEach(() => {
    service = new ServersService();
  });

  // ── Create ─────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("should create server with default channels, @world role, and owner membership", async () => {
      const server = makeServer({ id: "s1", name: "My Server", ownerId: "user-1" });
      const fullServer = {
        ...server,
        members: [makeMember({ userId: "user-1", serverId: "s1" })],
        channels: [],
        roles: [makeRole({ name: "@world", isWorld: true })],
      };

      // $transaction passes mockPrisma as tx, so mock its models directly
      vi.mocked(prisma.server.create).mockResolvedValue(server as any);
      vi.mocked(prisma.server.findUnique).mockResolvedValue(fullServer as any);
      vi.mocked(prisma.serverMember.create).mockResolvedValue({} as any);
      vi.mocked(prisma.role.create).mockResolvedValue({} as any);
      vi.mocked(prisma.channel.createMany).mockResolvedValue({ count: 2 } as any);

      const result = await service.create(
        { name: "My Server", icon: null, description: null },
        "user-1",
      );

      expect(result).toBeTruthy();
      expect(result!.name).toBe("My Server");
      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "@world",
            isWorld: true,
            position: 0,
          }),
        }),
      );
    });
  });

  // ── Update ─────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("should update server name with permission", async () => {
      const server = makeServer({ id: "s1" });
      vi.mocked(prisma.server.findUnique).mockResolvedValue(server as any);
      vi.mocked(prisma.server.update).mockResolvedValue({ ...server, name: "Updated" } as any);

      const result = await service.update("s1", { name: "Updated" }, "user-1");

      expect(result.name).toBe("Updated");
      expect(checkPermission).toHaveBeenCalled();
    });
  });

  // ── Delete ─────────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("should delete server if caller is owner", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "user-1" }) as any,
      );
      vi.mocked(prisma.serverMember.findMany).mockResolvedValue([
        { userId: "user-1", serverId: "s1" },
      ] as any);
      vi.mocked(prisma.server.delete).mockResolvedValue({} as any);

      await expect(service.delete("s1", "user-1")).resolves.toBeUndefined();
    });

    it("should throw NOT_OWNER if non-owner tries to delete", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "user-1" }) as any,
      );

      await expect(service.delete("s1", "user-2")).rejects.toThrow(
        "Only the owner can delete the server",
      );
    });

    it("should throw SERVER_NOT_FOUND if server doesn't exist", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(null);

      await expect(service.delete("s1", "user-1")).rejects.toThrow("Server not found");
    });
  });

  // ── getById ────────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("should return server for a member", async () => {
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.server.findUnique).mockResolvedValue(makeServer() as any);

      const result = await service.getById("s1", "user-1");
      expect(result).toBeTruthy();
    });

    it("should throw if user is not a member", async () => {
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(null);

      await expect(service.getById("s1", "user-1")).rejects.toThrow("Server not found");
    });
  });

  // ── Join by invite code ────────────────────────────────────────────────────

  describe("joinByInviteCode", () => {
    it("should join server with valid invite code", async () => {
      const server = makeServer({ inviteCode: "abc123" });
      vi.mocked(prisma.server.findUnique).mockResolvedValue(server as any);
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(null); // not already member
      vi.mocked(prisma.serverMember.create).mockResolvedValue({} as any);
      vi.mocked(prisma.channel.findMany).mockResolvedValue([]);

      const result = await service.joinByInviteCode("abc123", "user-2");
      expect(result).toBeTruthy();
    });

    it("should throw INVALID_INVITE_CODE for bad code", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(null);

      await expect(service.joinByInviteCode("bad-code", "user-1")).rejects.toThrow(
        "Invalid invite code",
      );
    });

    it("should throw ALREADY_MEMBER if already in server", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(makeServer() as any);
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);

      await expect(service.joinByInviteCode("code", "user-1")).rejects.toThrow(
        "You are already a member of this server",
      );
    });
  });

  // ── Leave ──────────────────────────────────────────────────────────────────

  describe("leave", () => {
    it("should allow non-owner to leave", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "user-1" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(
        makeMember({ userId: "user-2" }) as any,
      );
      vi.mocked(prisma.serverMember.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.channel.findMany).mockResolvedValue([]);

      await expect(service.leave("s1", "user-2")).resolves.toBeUndefined();
    });

    it("should prevent owner from leaving", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "user-1" }) as any,
      );

      await expect(service.leave("s1", "user-1")).rejects.toThrow(
        "Owners cannot leave their own server",
      );
    });
  });

  // ── Kick ───────────────────────────────────────────────────────────────────

  describe("kickMember", () => {
    it("should kick member with permission and hierarchy", async () => {
      vi.mocked(prisma.serverMember.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.channel.findMany).mockResolvedValue([]);

      await expect(service.kickMember("s1", "target", "actor")).resolves.toBeUndefined();
      expect(checkPermission).toHaveBeenCalled();
      expect(checkRoleHierarchy).toHaveBeenCalled();
    });
  });

  // ── Ban ────────────────────────────────────────────────────────────────────

  describe("banMember", () => {
    it("should ban member and remove membership", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          memberRole: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          serverBan: { create: vi.fn().mockResolvedValue({}) },
          serverMember: { delete: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });
      vi.mocked(prisma.channel.findMany).mockResolvedValue([]);

      await expect(
        service.banMember("s1", "target", "actor", "reason"),
      ).resolves.toBeUndefined();
    });
  });

  // ── Unban ──────────────────────────────────────────────────────────────────

  describe("unbanMember", () => {
    it("should remove server ban", async () => {
      vi.mocked(prisma.serverBan.delete).mockResolvedValue({} as any);

      await expect(service.unbanMember("s1", "target", "actor")).resolves.toBeUndefined();
    });
  });

  // ── Transfer ownership ────────────────────────────────────────────────────

  describe("transferOwnership", () => {
    it("should transfer ownership to a member", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "user-1" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(
        makeMember({ userId: "user-2" }) as any,
      );
      vi.mocked(prisma.server.update).mockResolvedValue({} as any);

      await expect(
        service.transferOwnership("s1", "user-2", "user-1"),
      ).resolves.toBeUndefined();
    });

    it("should throw NOT_OWNER if non-owner tries", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "user-1" }) as any,
      );

      await expect(
        service.transferOwnership("s1", "user-3", "user-2"),
      ).rejects.toThrow("Only the owner can transfer ownership");
    });

    it("should throw if new owner is not a member", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "user-1" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(null);

      await expect(
        service.transferOwnership("s1", "user-3", "user-1"),
      ).rejects.toThrow("New owner must be a member of the server");
    });
  });
});
