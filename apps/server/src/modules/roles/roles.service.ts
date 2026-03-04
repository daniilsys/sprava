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
      const count = await tx.role.count({ where: { serverId } });
      return tx.role.create({
        data: {
          id: generateId(),
          serverId,
          name: dto.name,
          color: dto.color,
          permissions: dto.permissions ? BigInt(dto.permissions) : 0n,
          position: count, // append at the end (0-indexed)
        },
      });
    });

    return toRoleResponse(role);
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

    const updated = await prisma.$transaction(async (tx) => {
      if (dto.position !== undefined && dto.position !== role.position) {
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
        },
      });
    });

    return toRoleResponse(updated);
  }

  async delete(serverId: string, roleId: string, userId: string) {
    await checkPermission(userId, serverId, Permission.CONFIGURE_ROLES);
    const role = await prisma.role.findFirst({
      where: { id: roleId, serverId },
    });
    if (!role) throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");

    await prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id: roleId } });
      // Close the gap: shift all roles after the deleted one up
      await tx.role.updateMany({
        where: { serverId, position: { gt: role.position } },
        data: { position: { decrement: 1 } },
      });
    });
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
    return toRoleResponse(updated);
  }

  async getMemberRoles(serverId: string, userId: string, memberId: string) {
    await this.requireMember(serverId, userId);
    const memberRoles = await prisma.memberRole.findMany({
      where: { memberId },
      include: { role: true },
    });
    return memberRoles
      .map((mr) => mr.role)
      .sort((a, b) => a.position - b.position)
      .map(toRoleResponse);
  }
}
