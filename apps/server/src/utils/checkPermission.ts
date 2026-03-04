import { prisma } from "../config/db.js";
import { PermissionUtils } from "@sprava/shared";
import { AppError } from "./AppError.js";

/**
 * Computes the effective permission bitfield for a user in a server,
 * optionally applying channel-level rules on top.
 *
 * Resolution order:
 *   1. Server owner → all permissions (~0n), channel rules skipped.
 *   2. Union of server-level role permissions.
 *   3. ADMINISTRATOR → channel rules skipped.
 *   4. Apply deny/allow from each role-based ChannelRule (lower priority).
 *   5. Apply deny/allow from the member-specific ChannelRule (highest priority).
 */
export async function getEffectivePermissions(
  userId: string,
  serverId: string,
  channelId?: string,
): Promise<bigint> {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) throw new AppError("Server not found", 404, "SERVER_NOT_FOUND");

  // Owner bypasses everything
  if (server.ownerId === userId) return ~0n;

  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
  });
  if (!member) throw new AppError("Server not found", 404, "SERVER_NOT_FOUND");

  const memberRoles = await prisma.memberRole.findMany({
    where: { memberId: userId, role: { serverId } },
    include: { role: true },
  });

  // Server-level permissions: union of all role permissions
  let permissions = memberRoles.reduce(
    (acc, mr) => acc | mr.role.permissions,
    0n,
  );

  // ADMINISTRATOR bypasses channel rules
  if (!channelId || PermissionUtils.isAdministrator(permissions))
    return permissions;

  // Apply role-based channel rules (one per role, lower priority)
  const roleIds = memberRoles.map((mr) => mr.roleId);
  const roleRules = await prisma.channelRule.findMany({
    where: { channelId, roleId: { in: roleIds } },
  });

  for (const rule of roleRules) {
    permissions = (permissions & ~rule.deny) | rule.allow;
  }

  // Apply member-specific channel rule (highest priority)
  const memberRule = await prisma.channelRule.findUnique({
    where: { channelId_memberId: { channelId, memberId: userId } },
  });
  if (memberRule) {
    permissions = (permissions & ~memberRule.deny) | memberRule.allow;
  }

  return permissions;
}

/**
 * Throws MISSING_PERMISSION if the user does not have the required permission.
 * Pass channelId to also apply channel-level rules.
 */
export async function checkPermission(
  userId: string,
  serverId: string,
  permission: bigint,
  channelId?: string,
): Promise<void> {
  const effective = await getEffectivePermissions(userId, serverId, channelId);
  if (!PermissionUtils.hasWithAdministrator(effective, permission)) {
    throw new AppError(
      "You don't have permission to do this",
      403,
      "MISSING_PERMISSION",
    );
  }
}

/**
 * Throws HIERARCHY_VIOLATION if the actor cannot act on the target
 * based on role positions. Owner always wins; target owner is untouchable.
 */
export async function checkRoleHierarchy(
  actorId: string,
  targetId: string,
  serverId: string,
): Promise<void> {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) throw new AppError("Server not found", 404, "SERVER_NOT_FOUND");
  const actorMember = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId: actorId, serverId } },
  });
  if (!actorMember)
    throw new AppError("Server not found", 404, "SERVER_NOT_FOUND");

  if (server.ownerId === actorId) return;

  if (server.ownerId === targetId) {
    throw new AppError(
      "You cannot act on the server owner",
      403,
      "HIERARCHY_VIOLATION",
    );
  }

  const [actorRoles, targetRoles] = await Promise.all([
    prisma.memberRole.findMany({
      where: { memberId: actorId, role: { serverId } },
      include: { role: { select: { position: true } } },
    }),
    prisma.memberRole.findMany({
      where: { memberId: targetId, role: { serverId } },
      include: { role: { select: { position: true } } },
    }),
  ]);

  const actorHighest = actorRoles.reduce(
    (max, mr) => Math.max(max, mr.role.position),
    -1,
  );
  const targetHighest = targetRoles.reduce(
    (max, mr) => Math.max(max, mr.role.position),
    -1,
  );

  if (actorHighest <= targetHighest) {
    throw new AppError(
      "Your highest role must be above the target's",
      403,
      "HIERARCHY_VIOLATION",
    );
  }
}
