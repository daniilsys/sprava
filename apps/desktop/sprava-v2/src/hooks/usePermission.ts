import { useMemo } from "react";
import { usePermissionsStore, getMyPermissions, getMyChannelPermissions } from "../store/permissions.store";
import { useAppStore } from "../store/app.store";
import { useAuthStore } from "../store/auth.store";
import type { Role } from "../types/models";

const ADMINISTRATOR = 1n;

function check(perms: bigint, permission: bigint): boolean {
  return (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & permission) === permission;
}

export function usePermission(serverId: string | undefined, permission: bigint): boolean {
  const myRoleIds = usePermissionsStore((s) => serverId ? s.myRoleIds.get(serverId) : undefined);
  const roles = useAppStore((s) => s.roles);
  const server = useAppStore((s) => serverId ? s.servers.get(serverId) : undefined);
  const userId = useAuthStore((s) => s.user?.id);

  return useMemo(() => {
    if (!serverId) return true;
    return check(getMyPermissions(serverId), permission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, permission, myRoleIds, roles, server?.ownerId, userId]);
}

export function useChannelPermission(serverId: string | undefined, channelId: string | undefined, permission: bigint): boolean {
  const myRoleIds = usePermissionsStore((s) => serverId ? s.myRoleIds.get(serverId) : undefined);
  const channelRules = usePermissionsStore((s) => channelId ? s.channelRules.get(channelId) : undefined);
  const roles = useAppStore((s) => s.roles);
  const server = useAppStore((s) => serverId ? s.servers.get(serverId) : undefined);
  const userId = useAuthStore((s) => s.user?.id);

  return useMemo(() => {
    if (!serverId || !channelId) return true;
    return check(getMyChannelPermissions(serverId, channelId), permission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, channelId, permission, myRoleIds, channelRules, roles, server?.ownerId, userId]);
}

/**
 * Returns the current user's highest role position in a server.
 * Owner returns -1 (above all roles). No roles returns Infinity.
 * Lower position number = higher rank.
 */
export function useMyHighestRolePosition(serverId: string | undefined): number {
  const myRoleIds = usePermissionsStore((s) => serverId ? s.myRoleIds.get(serverId) : undefined);
  const roles = useAppStore((s) => s.roles);
  const server = useAppStore((s) => serverId ? s.servers.get(serverId) : undefined);
  const userId = useAuthStore((s) => s.user?.id);

  return useMemo(() => {
    if (!serverId || !userId) return Infinity;
    if (server?.ownerId === userId) return -1; // Owner outranks everyone
    if (!myRoleIds) return Infinity;
    let highest = Infinity;
    for (const roleId of myRoleIds) {
      const role = roles.get(roleId);
      if (role && role.position < highest) highest = role.position;
    }
    return highest;
  }, [serverId, userId, server?.ownerId, myRoleIds, roles]);
}

/**
 * Get a member's highest role position from their roleIds.
 * Returns Infinity if they have no roles.
 */
export function getMemberHighestRolePosition(memberRoleIds: string[] | undefined, rolesMap: Map<string, Role>): number {
  if (!memberRoleIds || memberRoleIds.length === 0) return Infinity;
  let highest = Infinity;
  for (const roleId of memberRoleIds) {
    const role = rolesMap.get(roleId);
    if (role && role.position < highest) highest = role.position;
  }
  return highest;
}

export function useHasAnyPermission(serverId: string | undefined, ...permissions: bigint[]): boolean {
  const myRoleIds = usePermissionsStore((s) => serverId ? s.myRoleIds.get(serverId) : undefined);
  const roles = useAppStore((s) => s.roles);
  const server = useAppStore((s) => serverId ? s.servers.get(serverId) : undefined);
  const userId = useAuthStore((s) => s.user?.id);

  return useMemo(() => {
    if (!serverId) return true;
    const perms = getMyPermissions(serverId);
    if ((perms & ADMINISTRATOR) === ADMINISTRATOR) return true;
    return permissions.some((p) => (perms & p) === p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, ...permissions, myRoleIds, roles, server?.ownerId, userId]);
}
