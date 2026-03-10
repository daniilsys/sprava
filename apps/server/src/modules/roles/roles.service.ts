import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { generateId } from "../../utils/snowflake.js";
import { checkPermission } from "../../utils/checkPermission.js";
import { Permission } from "@sprava/shared";
import type {
  CreateRoleDto,
  UpdateRoleDto,
  UpdatePermissionsDto,
} from "./roles.schema.js";
import { toRoleResponse } from "./roles.mapper.js";
import { getIO } from "../../websocket/index.js";
import { createAuditEntry } from "../audit/audit.service.js";

export class RolesService {
  private async requireMember(serverId: string, userId: string) {
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member)
      throw new AppError("Server not found", 404, "SERVER_NOT_FOUND");
    return member;
  }

  async list(serverId: string, userId: string) {
    await this.requireMember(serverId, userId);
    const roles = await prisma.role.findMany({
      where: { serverId },
      orderBy: { position: "asc" },
    });
    return roles.map(toRoleResponse);
  }

  async create(serverId: string, dto: CreateRoleDto, userId: string) {
    await checkPermission(userId, serverId, Permission.CONFIGURE_ROLES);

    const role = await prisma.$transaction(async (tx) => {
      // @world always stays at the last position — insert new role just before it
      const worldRole = await tx.role.findFirst({
        where: { serverId, isWorld: true },
      });
      const insertPos = worldRole ? worldRole.position : await tx.role.count({ where: { serverId } });

      if (worldRole) {
        await tx.role.update({
          where: { id: worldRole.id },
          data: { position: worldRole.position + 1 },
        });
      }

      return tx.role.create({
        data: {
          id: generateId(),
          serverId,
          name: dto.name,
          color: dto.color,
          permissions: dto.permissions ? BigInt(dto.permissions) : 0n,
          position: insertPos,
          separate: dto.separate ?? false,
        },
      });
    });

    const response = toRoleResponse(role);

    await createAuditEntry(serverId, userId, "ROLE_CREATE", "Role", role.id, {
      roleName: dto.name,
    });

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("role:created", { serverId, role: response });
    }

    return response;
  }

  async update(
    serverId: string,
    roleId: string,
    dto: UpdateRoleDto,
    userId: string,
  ) {
    await checkPermission(userId, serverId, Permission.CONFIGURE_ROLES);
    const role = await prisma.role.findFirst({
      where: { id: roleId, serverId },
    });
    if (!role) throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");
    if (role.isWorld) {
      if (dto.position !== undefined)
        throw new AppError("Cannot move the @world role", 400, "CANNOT_MOVE_WORLD_ROLE");
      if (dto.name !== undefined)
        throw new AppError("Cannot rename the @world role", 400, "CANNOT_RENAME_WORLD_ROLE");
      if (dto.color !== undefined)
        throw new AppError("Cannot change the @world role color", 400, "CANNOT_RECOLOR_WORLD_ROLE");
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (dto.position !== undefined && dto.position !== role.position) {
        // Prevent moving a role to or past @world's position
        const worldRole = await tx.role.findFirst({
          where: { serverId, isWorld: true },
        });
        if (worldRole && dto.position >= worldRole.position) {
          throw new AppError(
            "Cannot move a role past the @world role",
            400,
            "CANNOT_MOVE_PAST_WORLD_ROLE",
          );
        }

        const oldPos = role.position;
        const newPos = dto.position;

        if (newPos > oldPos) {
          // Moving down: shift roles in (oldPos, newPos] up by -1
          await tx.role.updateMany({
            where: { serverId, position: { gt: oldPos, lte: newPos } },
            data: { position: { decrement: 1 } },
          });
        } else {
          // Moving up: shift roles in [newPos, oldPos) down by +1
          await tx.role.updateMany({
            where: { serverId, position: { gte: newPos, lt: oldPos } },
            data: { position: { increment: 1 } },
          });
        }
      }

      return tx.role.update({
        where: { id: roleId },
        data: {
          name: dto.name,
          color: dto.color,
          permissions:
            dto.permissions !== undefined ? BigInt(dto.permissions) : undefined,
          ...(dto.position !== undefined ? { position: dto.position } : {}),
          ...(dto.separate !== undefined ? { separate: dto.separate } : {}),
        },
      });
    });

    const response = toRoleResponse(updated);

    await createAuditEntry(serverId, userId, "ROLE_UPDATE", "Role", roleId, {
      roleName: dto.name ?? role.name,
    });

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("role:updated", { serverId, role: response });
    }

    return response;
  }

  async delete(serverId: string, roleId: string, userId: string) {
    await checkPermission(userId, serverId, Permission.CONFIGURE_ROLES);
    const role = await prisma.role.findFirst({
      where: { id: roleId, serverId },
    });
    if (!role) throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");
    if (role.isWorld)
      throw new AppError(
        "Cannot delete the @world role",
        400,
        "CANNOT_DELETE_WORLD_ROLE",
      );

    await prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id: roleId } });
      // Close the gap: shift all roles after the deleted one up
      await tx.role.updateMany({
        where: { serverId, position: { gt: role.position } },
        data: { position: { decrement: 1 } },
      });
    });

    await createAuditEntry(serverId, userId, "ROLE_DELETE", "Role", roleId, {
      roleName: role.name,
    });

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("role:deleted", { serverId, roleId });
    }
  }

  async assignToMember(
    serverId: string,
    roleId: string,
    targetUserId: string,
    userId: string,
  ) {
    await checkPermission(userId, serverId, Permission.CONFIGURE_ROLES);

    const role = await prisma.role.findFirst({
      where: { id: roleId, serverId },
    });
    if (!role) throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");
    if (role.isWorld)
      throw new AppError(
        "Cannot assign the @world role",
        400,
        "CANNOT_ASSIGN_WORLD_ROLE",
      );

    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: targetUserId, serverId } },
    });
    if (!member)
      throw new AppError("Member not found", 404, "MEMBER_NOT_FOUND");

    const existing = await prisma.memberRole.findUnique({
      where: { memberId_roleId: { memberId: member.userId, roleId } },
    });
    if (existing)
      throw new AppError(
        "Role already assigned to this member",
        400,
        "ROLE_ALREADY_ASSIGNED",
      );

    await prisma.memberRole.create({
      data: { memberId: member.userId, roleId },
    });

    await createAuditEntry(serverId, userId, "ROLE_ASSIGN", "Role", roleId, {
      roleName: role.name,
      targetUserId,
    });

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("role:assigned", { serverId, roleId, userId: targetUserId });
      io.to(`user:${targetUserId}`).emit("role:self_assigned", { serverId, roleId });
    }
  }

  async removeFromMember(
    serverId: string,
    roleId: string,
    targetUserId: string,
    userId: string,
  ) {
    await checkPermission(userId, serverId, Permission.CONFIGURE_ROLES);

    const role = await prisma.role.findFirst({
      where: { id: roleId, serverId },
    });
    if (!role) throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");
    if (role.isWorld)
      throw new AppError(
        "Cannot unassign the @world role",
        400,
        "CANNOT_UNASSIGN_WORLD_ROLE",
      );

    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: targetUserId, serverId } },
    });
    if (!member)
      throw new AppError("Member not found", 404, "MEMBER_NOT_FOUND");

    const existing = await prisma.memberRole.findUnique({
      where: { memberId_roleId: { memberId: member.userId, roleId } },
    });
    if (!existing)
      throw new AppError(
        "Role not assigned to this member",
        400,
        "ROLE_NOT_ASSIGNED",
      );

    await prisma.memberRole.delete({
      where: { memberId_roleId: { memberId: member.userId, roleId } },
    });

    await createAuditEntry(serverId, userId, "ROLE_REMOVE", "Role", roleId, {
      roleName: role.name,
      targetUserId,
    });

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("role:removed", { serverId, roleId, userId: targetUserId });
      io.to(`user:${targetUserId}`).emit("role:self_removed", { serverId, roleId });
    }
  }

  async updatePermissions(
    serverId: string,
    roleId: string,
    dto: UpdatePermissionsDto,
    userId: string,
  ) {
    await checkPermission(userId, serverId, Permission.CONFIGURE_ROLES);
    const role = await prisma.role.findFirst({
      where: { id: roleId, serverId },
    });
    if (!role) throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");
    const updated = await prisma.role.update({
      where: { id: roleId },
      data: { permissions: BigInt(dto.permissions) },
    });

    const response = toRoleResponse(updated);

    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit("role:updated", { serverId, role: response });
    }

    return response;
  }

  async getMemberRoles(serverId: string, userId: string, memberId: string) {
    await this.requireMember(serverId, userId);
    const memberRoles = await prisma.memberRole.findMany({
      where: { memberId, role: { serverId } },
      include: { role: true },
    });
    return memberRoles
      .map((mr) => mr.role)
      .sort((a, b) => a.position - b.position)
      .map(toRoleResponse);
  }
}
