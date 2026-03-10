import { prisma } from "../../config/db.js";
import { generateId } from "../../utils/snowflake.js";
import { checkPermission } from "../../utils/checkPermission.js";
import { Permission } from "@sprava/shared";
import type { AuditLogQuery } from "./audit.schema.js";

export async function createAuditEntry(
  serverId: string,
  userId: string,
  actionType: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      id: generateId(),
      serverId,
      userId,
      actionType,
      targetType,
      targetId,
      metadata: metadata as any ?? undefined,
    },
  });
}

export async function getAuditLog(
  serverId: string,
  userId: string,
  { cursor, limit: rawLimit = 50, actionType }: Partial<AuditLogQuery> = {},
) {
  const limit = Number(rawLimit);

  await checkPermission(
    userId,
    serverId,
    Permission.CONFIGURE_SERVER,
  );

  const entries = await prisma.auditLog.findMany({
    where: {
      serverId,
      ...(actionType ? { actionType } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      user: {
        select: { id: true, username: true, avatar: true },
      },
    },
  });

  const hasMore = entries.length > limit;
  if (hasMore) entries.pop();

  // Resolve target users (kick/ban/unban/ownership transfer)
  const userTargetIds = entries
    .filter((e) => e.targetType === "User" && e.targetId)
    .map((e) => e.targetId!);

  const uniqueUserTargetIds = [...new Set(userTargetIds)];
  const targetUsersMap = new Map<string, { id: string; username: string; avatar: string | null }>();

  if (uniqueUserTargetIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueUserTargetIds } },
      select: { id: true, username: true, avatar: true },
    });
    for (const u of users) {
      targetUsersMap.set(u.id, u);
    }
  }

  return {
    data: entries.map((e) => ({
      id: e.id,
      serverId: e.serverId,
      userId: e.userId,
      actionType: e.actionType,
      targetType: e.targetType,
      targetId: e.targetId,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
      user: e.user,
      target: e.targetId && e.targetType === "User"
        ? targetUsersMap.get(e.targetId) ?? null
        : null,
    })),
    cursor: hasMore
      ? entries[entries.length - 1].createdAt.toISOString()
      : null,
  };
}
