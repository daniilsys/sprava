import { create } from "zustand";
import { useAppStore } from "./app.store";
import { useAuthStore } from "./auth.store";
import type { ChannelRule } from "../types/models";

// Permission bits from packages/shared/src/permissions.ts
const ADMINISTRATOR = 1n;

interface PermissionsState {
  // serverId -> set of roleIds that the current user has
  myRoleIds: Map<string, Set<string>>;

  // channelId -> array of channel rules (for all users/roles, not just current user)
  channelRules: Map<string, ChannelRule[]>;

  // Hydrate from ready event
  hydrate(memberRoleIds: Record<string, string[]>): void;
  hydrateChannelRules(rules: ChannelRule[]): void;

  // Add/remove a role for a server
  addRole(serverId: string, roleId: string): void;
  removeRole(serverId: string, roleId: string): void;

  // Channel rule mutations
  upsertChannelRule(rule: ChannelRule): void;
  deleteChannelRule(channelId: string, roleId: string | null, memberId: string | null): void;

  // Remove all data for a server (on leave/kick/delete)
  removeServer(serverId: string, channelIds: string[]): void;

  // Clear on logout
  clear(): void;
}

export const usePermissionsStore = create<PermissionsState>((set) => ({
  myRoleIds: new Map(),
  channelRules: new Map(),

  hydrate(memberRoleIds) {
    const myRoleIds = new Map<string, Set<string>>();
    for (const [serverId, roleIds] of Object.entries(memberRoleIds)) {
      myRoleIds.set(serverId, new Set(roleIds));
    }
    set({ myRoleIds });
  },

  hydrateChannelRules(rules) {
    const channelRules = new Map<string, ChannelRule[]>();
    for (const rule of rules) {
      const arr = channelRules.get(rule.channelId) ?? [];
      arr.push(rule);
      channelRules.set(rule.channelId, arr);
    }
    set({ channelRules });
  },

  addRole(serverId, roleId) {
    set((s) => {
      const myRoleIds = new Map(s.myRoleIds);
      const roles = new Set(myRoleIds.get(serverId) ?? []);
      roles.add(roleId);
      myRoleIds.set(serverId, roles);
      return { myRoleIds };
    });
  },

  removeRole(serverId, roleId) {
    set((s) => {
      const myRoleIds = new Map(s.myRoleIds);
      const roles = new Set(myRoleIds.get(serverId) ?? []);
      roles.delete(roleId);
      myRoleIds.set(serverId, roles);
      return { myRoleIds };
    });
  },

  upsertChannelRule(rule) {
    set((s) => {
      const channelRules = new Map(s.channelRules);
      const existing = channelRules.get(rule.channelId) ?? [];
      // Replace existing rule for same target, or append
      const idx = existing.findIndex(
        (r) =>
          (rule.roleId && r.roleId === rule.roleId) ||
          (rule.memberId && r.memberId === rule.memberId),
      );
      const updated = [...existing];
      if (idx >= 0) {
        updated[idx] = rule;
      } else {
        updated.push(rule);
      }
      channelRules.set(rule.channelId, updated);
      return { channelRules };
    });
  },

  deleteChannelRule(channelId, roleId, memberId) {
    set((s) => {
      const channelRules = new Map(s.channelRules);
      const existing = channelRules.get(channelId) ?? [];
      const filtered = existing.filter((r) => {
        if (roleId) return r.roleId !== roleId;
        if (memberId) return r.memberId !== memberId;
        return true;
      });
      if (filtered.length > 0) {
        channelRules.set(channelId, filtered);
      } else {
        channelRules.delete(channelId);
      }
      return { channelRules };
    });
  },

  removeServer(serverId, channelIds) {
    set((s) => {
      const myRoleIds = new Map(s.myRoleIds);
      myRoleIds.delete(serverId);

      const channelRules = new Map(s.channelRules);
      for (const channelId of channelIds) {
        channelRules.delete(channelId);
      }

      return { myRoleIds, channelRules };
    });
  },

  clear() {
    set({ myRoleIds: new Map(), channelRules: new Map() });
  },
}));

/**
 * Compute effective permissions for current user in a server.
 * Uses roles from app store + myRoleIds from permissions store.
 */
export function getMyPermissions(serverId: string): bigint {
  const server = useAppStore.getState().servers.get(serverId);
  const currentUserId = useAuthStore.getState().user?.id;

  // Owner gets all permissions
  if (server?.ownerId && server.ownerId === currentUserId) return ~0n;

  const allRoles = useAppStore.getState().roles;

  // Start with @world permissions (applies to all members implicitly)
  let perms = 0n;
  for (const role of allRoles.values()) {
    if (role.serverId === serverId && role.isWorld) {
      perms |= BigInt(role.permissions);
      break;
    }
  }

  // OR in all assigned role permissions
  const myRoleIds = usePermissionsStore.getState().myRoleIds.get(serverId);
  if (myRoleIds) {
    for (const roleId of myRoleIds) {
      const role = allRoles.get(roleId);
      if (role) perms |= BigInt(role.permissions);
    }
  }

  return perms;
}

/**
 * Compute effective permissions for current user in a specific channel.
 * Applies channel rules (allow/deny overrides) on top of server-level permissions.
 *
 * Discord algorithm: base server perms → apply @world channel rule → apply role rules → apply member rule
 * deny bits remove permissions, allow bits add them.
 */
export function getMyChannelPermissions(serverId: string, channelId: string): bigint {
  const server = useAppStore.getState().servers.get(serverId);
  const currentUserId = useAuthStore.getState().user?.id;

  // Owner bypasses everything
  if (server?.ownerId && server.ownerId === currentUserId) return ~0n;

  let perms = getMyPermissions(serverId);

  // If user is admin, bypass channel rules
  if ((perms & ADMINISTRATOR) === ADMINISTRATOR) return perms;

  const rules = usePermissionsStore.getState().channelRules.get(channelId);
  if (!rules || rules.length === 0) return perms;

  const allRoles = useAppStore.getState().roles;
  const myRoleIds = usePermissionsStore.getState().myRoleIds.get(serverId);

  // 1. Apply @world role channel rule
  for (const role of allRoles.values()) {
    if (role.serverId === serverId && role.isWorld) {
      const worldRule = rules.find((r) => r.roleId === role.id);
      if (worldRule) {
        perms &= ~BigInt(worldRule.deny);
        perms |= BigInt(worldRule.allow);
      }
      break;
    }
  }

  // 2. Apply role-based channel rules (combine all allow/deny from user's roles)
  let roleAllow = 0n;
  let roleDeny = 0n;
  if (myRoleIds) {
    for (const roleId of myRoleIds) {
      const roleRule = rules.find((r) => r.roleId === roleId);
      if (roleRule) {
        roleAllow |= BigInt(roleRule.allow);
        roleDeny |= BigInt(roleRule.deny);
      }
    }
  }
  perms &= ~roleDeny;
  perms |= roleAllow;

  // 3. Apply member-specific channel rule (highest priority)
  if (currentUserId) {
    const memberRule = rules.find((r) => r.memberId === currentUserId);
    if (memberRule) {
      perms &= ~BigInt(memberRule.deny);
      perms |= BigInt(memberRule.allow);
    }
  }

  return perms;
}

export function hasPermission(serverId: string, permission: bigint): boolean {
  const perms = getMyPermissions(serverId);
  return (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & permission) === permission;
}

export function hasChannelPermission(serverId: string, channelId: string, permission: bigint): boolean {
  const perms = getMyChannelPermissions(serverId, channelId);
  return (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & permission) === permission;
}
