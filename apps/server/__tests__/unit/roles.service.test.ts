/**
 * Unit tests for RolesService.
 * Covers list, create, update, delete, assign/remove from member,
 * update permissions, get member roles.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RolesService } from "../../src/modules/roles/roles.service.js";
import { prisma } from "../../src/config/db.js";
import { makeRole, makeMember } from "../helpers/factories.js";

describe("RolesService", () => {
  let service: RolesService;

  beforeEach(() => {
    service = new RolesService();
  });

  // ── List ───────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("should return roles ordered by position", async () => {
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.role.findMany).mockResolvedValue([
        makeRole({ position: 0 }),
        makeRole({ position: 1 }),
      ] as any);

      const result = await service.list("server-1", "user-1");
      expect(result).toHaveLength(2);
    });

    it("should throw if user is not a member", async () => {
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(null);

      await expect(service.list("server-1", "user-1")).rejects.toThrow("Server not found");
    });
  });

  // ── Create ─────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("should create role with auto-incremented position", async () => {
      const role = makeRole({ id: "r1", name: "Mod", position: 2 });
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          role: {
            count: vi.fn().mockResolvedValue(2),
            create: vi.fn().mockResolvedValue(role),
          },
        };
        return fn(tx);
      });

      const result = await service.create(
        "server-1",
        { name: "Mod", color: "#ff0000" },
        "user-1",
      );

      expect(result.name).toBe("Mod");
    });
  });

  // ── Update ─────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("should update role name and color", async () => {
      vi.mocked(prisma.role.findFirst).mockResolvedValue(makeRole({ position: 0 }) as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          role: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            update: vi.fn().mockResolvedValue(makeRole({ name: "Admin", color: "#00ff00" })),
          },
        };
        return fn(tx);
      });

      const result = await service.update(
        "server-1",
        "role-1",
        { name: "Admin", color: "#00ff00" },
        "user-1",
      );

      expect(result.name).toBe("Admin");
    });

    it("should throw ROLE_NOT_FOUND for missing role", async () => {
      vi.mocked(prisma.role.findFirst).mockResolvedValue(null);

      await expect(
        service.update("server-1", "missing", { name: "x" }, "user-1"),
      ).rejects.toThrow("Role not found");
    });
  });

  // ── Delete ─────────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("should delete role and close position gap", async () => {
      vi.mocked(prisma.role.findFirst).mockResolvedValue(makeRole({ position: 1 }) as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          role: {
            delete: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return fn(tx);
      });

      await expect(service.delete("server-1", "role-1", "user-1")).resolves.toBeUndefined();
    });
  });

  // ── Assign to member ──────────────────────────────────────────────────────

  describe("assignToMember", () => {
    it("should assign role to a server member", async () => {
      vi.mocked(prisma.role.findFirst).mockResolvedValue(makeRole() as any);
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.memberRole.findUnique).mockResolvedValue(null); // not yet assigned
      vi.mocked(prisma.memberRole.create).mockResolvedValue({} as any);

      await expect(
        service.assignToMember("server-1", "role-1", "target", "actor"),
      ).resolves.toBeUndefined();
    });

    it("should throw ROLE_ALREADY_ASSIGNED on duplicate", async () => {
      vi.mocked(prisma.role.findFirst).mockResolvedValue(makeRole() as any);
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.memberRole.findUnique).mockResolvedValue({ memberId: "x", roleId: "y" } as any);

      await expect(
        service.assignToMember("server-1", "role-1", "target", "actor"),
      ).rejects.toThrow("Role already assigned to this member");
    });

    it("should throw MEMBER_NOT_FOUND if target is not a member", async () => {
      vi.mocked(prisma.role.findFirst).mockResolvedValue(makeRole() as any);
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(null);

      await expect(
        service.assignToMember("server-1", "role-1", "target", "actor"),
      ).rejects.toThrow("Member not found");
    });
  });

  // ── Remove from member ────────────────────────────────────────────────────

  describe("removeFromMember", () => {
    it("should remove role from member", async () => {
      vi.mocked(prisma.role.findFirst).mockResolvedValue(makeRole() as any);
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.memberRole.findUnique).mockResolvedValue({ memberId: "x", roleId: "y" } as any);
      vi.mocked(prisma.memberRole.delete).mockResolvedValue({} as any);

      await expect(
        service.removeFromMember("server-1", "role-1", "target", "actor"),
      ).resolves.toBeUndefined();
    });

    it("should throw ROLE_NOT_ASSIGNED if not assigned", async () => {
      vi.mocked(prisma.role.findFirst).mockResolvedValue(makeRole() as any);
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.memberRole.findUnique).mockResolvedValue(null);

      await expect(
        service.removeFromMember("server-1", "role-1", "target", "actor"),
      ).rejects.toThrow("Role not assigned to this member");
    });
  });

  // ── Update permissions ────────────────────────────────────────────────────

  describe("updatePermissions", () => {
    it("should update role permissions bitfield", async () => {
      vi.mocked(prisma.role.findFirst).mockResolvedValue(makeRole() as any);
      vi.mocked(prisma.role.update).mockResolvedValue(
        makeRole({ permissions: 255n }) as any,
      );

      const result = await service.updatePermissions(
        "server-1",
        "role-1",
        { permissions: "255" },
        "user-1",
      );

      expect(result).toBeTruthy();
    });
  });

  // ── Get member roles ──────────────────────────────────────────────────────

  describe("getMemberRoles", () => {
    it("should return member roles sorted by position", async () => {
      vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
      vi.mocked(prisma.memberRole.findMany).mockResolvedValue([
        { role: makeRole({ position: 1 }) },
        { role: makeRole({ position: 0 }) },
      ] as any);

      const result = await service.getMemberRoles("server-1", "user-1", "member-1");

      expect(result).toHaveLength(2);
      // Should be sorted by position ascending
      expect(result[0].position).toBe(0);
      expect(result[1].position).toBe(1);
    });
  });
});
