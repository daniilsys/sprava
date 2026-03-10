/**
 * Unit tests for the permission system.
 * Tests getEffectivePermissions, checkPermission, and checkRoleHierarchy.
 * These tests un-mock checkPermission to test the real logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../../src/config/db.js";
import { makeServer, makeMember, makeRole } from "../helpers/factories.js";

// Un-mock checkPermission for these tests — we want to test the real implementation
vi.unmock("../../src/utils/checkPermission.js");

// We need to dynamically import after un-mocking
let getEffectivePermissions: typeof import("../../src/utils/checkPermission.js")["getEffectivePermissions"];
let checkPermission: typeof import("../../src/utils/checkPermission.js")["checkPermission"];
let checkRoleHierarchy: typeof import("../../src/utils/checkPermission.js")["checkRoleHierarchy"];

beforeAll(async () => {
  const mod = await import("../../src/utils/checkPermission.js");
  getEffectivePermissions = mod.getEffectivePermissions;
  checkPermission = mod.checkPermission;
  checkRoleHierarchy = mod.checkRoleHierarchy;
});

// Also need to mock @sprava/shared to provide PermissionUtils
vi.mock("@sprava/shared", () => ({
  Permission: {
    VIEW_CHANNEL: 1n,
    POST_MESSAGES: 2n,
    CONFIGURE_SERVER: 4n,
    ADMINISTRATOR: 8n,
    CONFIGURE_CHANNELS: 16n,
    CONFIGURE_ROLES: 32n,
    KICK: 64n,
    BAN: 128n,
    UNBAN: 256n,
    READ_MESSAGES: 512n,
    JOIN_VOICE: 1024n,
  },
  PermissionUtils: {
    isAdministrator: (perms: bigint) => (perms & 8n) !== 0n,
    hasWithAdministrator: (perms: bigint, required: bigint) =>
      (perms & 8n) !== 0n || (perms & required) === required,
  },
}));

describe("Permission System", () => {
  // ── getEffectivePermissions ────────────────────────────────────────────────

  describe("getEffectivePermissions", () => {
    it("should return all permissions (~0n) for server owner", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "user-1" }) as any,
      );

      const perms = await getEffectivePermissions("user-1", "server-1");
      expect(perms).toBe(~0n);
    });

    it("should compute union of role permissions", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "other" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.memberRole.findMany).mockResolvedValue([
        { role: makeRole({ permissions: 1n }) },
        { role: makeRole({ permissions: 2n }) },
      ] as any);
      vi.mocked(prisma.role.findFirst).mockResolvedValue(null); // no @world role

      const perms = await getEffectivePermissions("user-1", "server-1");
      expect(perms).toBe(3n); // 1n | 2n
    });

    it("should include @world permissions for member with no roles", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "other" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.memberRole.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.role.findFirst).mockResolvedValue(
        makeRole({ id: "world-role", permissions: 5n, isWorld: true }) as any,
      );

      const perms = await getEffectivePermissions("user-1", "server-1");
      expect(perms).toBe(5n); // @world permissions only
    });

    it("should apply channel deny/allow rules", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "other" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.memberRole.findMany).mockResolvedValue([
        { role: makeRole({ permissions: 3n }), roleId: "role-1" },
      ] as any);
      vi.mocked(prisma.role.findFirst).mockResolvedValue(null); // no @world role
      // Channel rule denies permission 1n, allows permission 4n
      vi.mocked(prisma.channelRule.findMany).mockResolvedValue([
        { roleId: "role-1", allow: 4n, deny: 1n },
      ] as any);
      vi.mocked(prisma.channelRule.findUnique).mockResolvedValue(null); // no member rule

      const perms = await getEffectivePermissions("user-1", "server-1", "channel-1");
      // (3n & ~1n) | 4n = 2n | 4n = 6n
      expect(perms).toBe(6n);
    });

    it("should apply @world channel rule to all members", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "other" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.memberRole.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.role.findFirst).mockResolvedValue(
        makeRole({ id: "world-role", permissions: 7n, isWorld: true }) as any,
      );
      // @world channel rule denies permission 2n (POST_MESSAGES)
      vi.mocked(prisma.channelRule.findMany).mockResolvedValue([
        { roleId: "world-role", allow: 0n, deny: 2n },
      ] as any);
      vi.mocked(prisma.channelRule.findUnique).mockResolvedValue(null);

      const perms = await getEffectivePermissions("user-1", "server-1", "channel-1");
      // (7n & ~2n) | 0n = 5n
      expect(perms).toBe(5n);
    });

    it("should skip channel rules for ADMINISTRATOR", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "other" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.memberRole.findMany).mockResolvedValue([
        { role: makeRole({ permissions: 8n }), roleId: "role-1" }, // ADMINISTRATOR
      ] as any);
      vi.mocked(prisma.role.findFirst).mockResolvedValue(null); // no @world role

      const perms = await getEffectivePermissions("user-1", "server-1", "channel-1");
      // ADMINISTRATOR bypasses channel rules
      expect(perms).toBe(8n);
      expect(prisma.channelRule.findMany).not.toHaveBeenCalled();
    });

    it("should throw SERVER_NOT_FOUND for missing server", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(null);

      await expect(
        getEffectivePermissions("user-1", "missing"),
      ).rejects.toThrow("Server not found");
    });

    it("should throw if user is not a member", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "other" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(null);

      await expect(
        getEffectivePermissions("user-1", "server-1"),
      ).rejects.toThrow("Server not found");
    });
  });

  // ── checkPermission ───────────────────────────────────────────────────────

  describe("checkPermission", () => {
    it("should not throw when user has the required permission", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "user-1" }) as any,
      );

      await expect(
        checkPermission("user-1", "server-1", 1n),
      ).resolves.toBeUndefined();
    });

    it("should throw MISSING_PERMISSION when user lacks permission", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "other" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.memberRole.findMany).mockResolvedValue([
        { role: makeRole({ permissions: 1n }) },
      ] as any);
      vi.mocked(prisma.role.findFirst).mockResolvedValue(null); // no @world role

      await expect(
        checkPermission("user-1", "server-1", 4n), // needs CONFIGURE_SERVER
      ).rejects.toThrow("You don't have permission to do this");
    });
  });

  // ── checkRoleHierarchy ────────────────────────────────────────────────────

  describe("checkRoleHierarchy", () => {
    it("should allow owner to act on anyone", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "user-1" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);

      await expect(
        checkRoleHierarchy("user-1", "user-2", "server-1"),
      ).resolves.toBeUndefined();
    });

    it("should prevent acting on the server owner", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "user-2" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);

      await expect(
        checkRoleHierarchy("user-1", "user-2", "server-1"),
      ).rejects.toThrow("You cannot act on the server owner");
    });

    it("should prevent lower role from acting on higher role", async () => {
      vi.mocked(prisma.server.findUnique).mockResolvedValue(
        makeServer({ ownerId: "other" }) as any,
      );
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);

      // Actor has position 1, target has position 2
      vi.mocked(prisma.memberRole.findMany)
        .mockResolvedValueOnce([{ role: { position: 1 } }] as any) // actor
        .mockResolvedValueOnce([{ role: { position: 2 } }] as any); // target

      await expect(
        checkRoleHierarchy("actor", "target", "server-1"),
      ).rejects.toThrow("Your highest role must be above the target's");
    });
  });
});
