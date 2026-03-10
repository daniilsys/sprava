import { create } from "zustand";
import type {
  Server,
  Channel,
  Member,
  Role,
  DmConversation,
  Friendship,
  VoiceState,
  ReadyPayload,
  PresenceState,
  UserStatus,
} from "../types/models";
import { usePermissionsStore } from "./permissions.store";
import { getSocket } from "../lib/socket";

interface AppState {
  servers: Map<string, Server>;
  channels: Map<string, Channel>;
  members: Map<string, Map<string, Member>>; // serverId -> userId -> Member
  roles: Map<string, Role>;
  dms: Map<string, DmConversation>;
  friendships: Map<string, Friendship>;
  readStates: Map<string, string>; // channelId|dmId -> lastReadMessageId
  presence: Map<string, PresenceState>; // userId -> { status, statusMessage }
  voiceStates: VoiceState[];

  hydrateReady(payload: ReadyPayload): void;
  addServer(server: Server): void;
  removeServer(serverId: string): void;
  addChannel(channel: Channel): void;
  updateChannel(channel: Channel): void;
  removeChannel(channelId: string, serverId: string): void;
  addMember(serverId: string, member: Member): void;
  appendMembers(serverId: string, members: Member[]): void;
  removeMember(serverId: string, userId: string): void;
  addMemberRole(serverId: string, userId: string, roleId: string): void;
  removeMemberRole(serverId: string, userId: string, roleId: string): void;
  setPresence(userId: string, status: UserStatus, statusMessage?: string): void;
  markRead(contextId: string, messageId: string): void;
  addDm(dm: DmConversation): void;
  updateLastMessageId(contextId: string, messageId: string | null): void;
  updateServer(server: Partial<Server> & { id: string }): void;
  updateServerOwner(serverId: string, newOwnerId: string): void;
  addRole(role: Role): void;
  updateRole(role: Role): void;
  removeRole(roleId: string): void;
  updateDm(dm: Partial<DmConversation> & { id: string }): void;
  addDmParticipant(dmId: string, participant: { userId: string; user?: { id: string; username: string; avatar: string | null } }): void;
  removeDmParticipant(dmId: string, userId: string): void;
  addVoiceState(vs: VoiceState): void;
  removeVoiceState(userId: string): void;
}

export const useAppStore = create<AppState>((set, get) => ({
  servers: new Map(),
  channels: new Map(),
  members: new Map(),
  roles: new Map(),
  dms: new Map(),
  friendships: new Map(),
  readStates: new Map(),
  presence: new Map(),
  voiceStates: [],

  hydrateReady(payload) {
    const servers = new Map<string, Server>();
    const channels = new Map<string, Channel>();
    const members = new Map<string, Map<string, Member>>();
    const roles = new Map<string, Role>();
    const dms = new Map<string, DmConversation>();
    const friendships = new Map<string, Friendship>();
    const readStates = new Map<string, string>();

    for (const server of payload.servers) {
      servers.set(server.id, server);
      if (server.channels) {
        for (const ch of server.channels) channels.set(ch.id, ch);
      }
      if (server.roles) {
        for (const r of server.roles) roles.set(r.id, r);
      }
      if (server.members) {
        const memberMap = new Map<string, Member>();
        for (const m of server.members) memberMap.set(m.userId, m);
        members.set(server.id, memberMap);
      }
    }

    for (const dm of payload.dms) dms.set(dm.id, dm);
    for (const f of payload.friendships) friendships.set(f.id, f);
    for (const rs of payload.readStates) {
      const key = rs.channelId || rs.dmConversationId;
      if (key) readStates.set(key, rs.lastReadMessageId);
    }

    // Hydrate presence states
    const presence = new Map<string, PresenceState>();
    if (payload.presenceStates) {
      for (const [uid, ps] of Object.entries(payload.presenceStates)) {
        presence.set(uid, ps);
      }
    }

    set({
      servers,
      channels,
      members,
      roles,
      dms,
      friendships,
      readStates,
      presence,
      voiceStates: payload.voiceStates,
    });

    // Hydrate permissions
    if (payload.memberRoleIds) {
      usePermissionsStore.getState().hydrate(payload.memberRoleIds);
    }

    // Hydrate channel rules
    if (payload.channelRules) {
      usePermissionsStore.getState().hydrateChannelRules(payload.channelRules);
    }
  },

  addServer(server) {
    set((s) => {
      const servers = new Map(s.servers);
      servers.set(server.id, server);
      const channels = new Map(s.channels);
      if (server.channels) {
        for (const ch of server.channels) channels.set(ch.id, ch);
      }
      return { servers, channels };
    });
  },

  removeServer(serverId) {
    // Collect channel IDs and member userIds before removing
    const state = get();
    const serverChannelIds: string[] = [];
    for (const [id, ch] of state.channels) {
      if (ch.serverId === serverId) serverChannelIds.push(id);
    }

    const serverMembers = state.members.get(serverId);
    const memberUserIds: string[] = [];
    if (serverMembers) {
      for (const uid of serverMembers.keys()) {
        memberUserIds.push(uid);
      }
    }

    set((s) => {
      const servers = new Map(s.servers);
      servers.delete(serverId);
      const channels = new Map(s.channels);
      for (const id of serverChannelIds) {
        channels.delete(id);
      }
      const members = new Map(s.members);
      members.delete(serverId);

      // Clean up roles belonging to this server
      const roles = new Map(s.roles);
      for (const [id, role] of roles) {
        if (role.serverId === serverId) roles.delete(id);
      }

      // Clean up readStates for this server's channels
      const readStates = new Map(s.readStates);
      for (const id of serverChannelIds) {
        readStates.delete(id);
      }

      // Clean up voiceStates for this server's channels
      const voiceStates = s.voiceStates.filter((vs) => {
        if (vs.roomId.startsWith("channel:")) {
          const channelId = vs.roomId.slice(8);
          return !serverChannelIds.includes(channelId);
        }
        return true;
      });

      return { servers, channels, members, roles, readStates, voiceStates };
    });

    // Clean up permissions store (myRoleIds + channelRules for this server)
    usePermissionsStore.getState().removeServer(serverId, serverChannelIds);

    // Unsubscribe from presence updates for members of this server
    if (memberUserIds.length > 0) {
      const sock = getSocket();
      if (sock?.connected) {
        sock.emit("presence:unsubscribe", { userIds: memberUserIds });
      }
    }
  },

  addChannel(channel) {
    set((s) => {
      const channels = new Map(s.channels);
      channels.set(channel.id, channel);
      return { channels };
    });
  },

  updateChannel(channel) {
    set((s) => {
      const channels = new Map(s.channels);
      channels.set(channel.id, channel);
      return { channels };
    });
  },

  removeChannel(channelId) {
    set((s) => {
      const channels = new Map(s.channels);
      channels.delete(channelId);
      return { channels };
    });
  },

  addMember(serverId, member) {
    set((s) => {
      const members = new Map(s.members);
      const serverMembers = new Map(members.get(serverId) || new Map());
      serverMembers.set(member.userId, member);
      members.set(serverId, serverMembers);
      return { members };
    });
  },

  appendMembers(serverId, newMembers) {
    set((s) => {
      const members = new Map(s.members);
      const serverMembers = new Map(members.get(serverId) || new Map());
      for (const m of newMembers) serverMembers.set(m.userId, m);
      members.set(serverId, serverMembers);
      return { members };
    });
  },

  removeMember(serverId, userId) {
    set((s) => {
      const members = new Map(s.members);
      const serverMembers = new Map(members.get(serverId) || new Map());
      serverMembers.delete(userId);
      members.set(serverId, serverMembers);
      return { members };
    });
  },

  addMemberRole(serverId, userId, roleId) {
    set((s) => {
      const serverMembers = s.members.get(serverId);
      const member = serverMembers?.get(userId);
      if (!member) return s;
      const roleIds = member.roleIds ?? [];
      if (roleIds.includes(roleId)) return s;
      const members = new Map(s.members);
      const updated = new Map(serverMembers);
      updated.set(userId, { ...member, roleIds: [...roleIds, roleId] });
      members.set(serverId, updated);
      return { members };
    });
  },

  removeMemberRole(serverId, userId, roleId) {
    set((s) => {
      const serverMembers = s.members.get(serverId);
      const member = serverMembers?.get(userId);
      if (!member || !member.roleIds) return s;
      const members = new Map(s.members);
      const updated = new Map(serverMembers);
      updated.set(userId, { ...member, roleIds: member.roleIds.filter((id) => id !== roleId) });
      members.set(serverId, updated);
      return { members };
    });
  },

  setPresence(userId, status, statusMessage) {
    set((s) => {
      const presence = new Map(s.presence);
      presence.set(userId, { status, statusMessage: statusMessage ?? "" });
      return { presence };
    });
  },

  markRead(contextId, messageId) {
    set((s) => {
      const readStates = new Map(s.readStates);
      readStates.set(contextId, messageId);
      return { readStates };
    });
  },

  addDm(dm) {
    set((s) => {
      const dms = new Map(s.dms);
      dms.set(dm.id, dm);
      return { dms };
    });
  },

  updateLastMessageId(contextId, messageId) {
    set((s) => {
      // Update channel if exists
      const channel = s.channels.get(contextId);
      if (channel) {
        const channels = new Map(s.channels);
        channels.set(contextId, { ...channel, lastMessageId: messageId });
        return { channels };
      }
      // Update DM if exists
      const dm = s.dms.get(contextId);
      if (dm) {
        const dms = new Map(s.dms);
        dms.set(contextId, { ...dm, lastMessageId: messageId });
        return { dms };
      }
      return {};
    });
  },

  updateServer(server) {
    set((s) => {
      const existing = s.servers.get(server.id);
      if (!existing) return {};
      const servers = new Map(s.servers);
      servers.set(server.id, { ...existing, ...server });
      return { servers };
    });
  },

  updateServerOwner(serverId, newOwnerId) {
    set((s) => {
      const existing = s.servers.get(serverId);
      if (!existing) return {};
      const servers = new Map(s.servers);
      servers.set(serverId, { ...existing, ownerId: newOwnerId });
      return { servers };
    });
  },

  addRole(role) {
    set((s) => {
      const roles = new Map(s.roles);
      roles.set(role.id, role);
      return { roles };
    });
  },

  updateRole(role) {
    set((s) => {
      const roles = new Map(s.roles);
      roles.set(role.id, role);
      return { roles };
    });
  },

  removeRole(roleId) {
    set((s) => {
      const roles = new Map(s.roles);
      roles.delete(roleId);
      return { roles };
    });
  },

  updateDm(dm) {
    set((s) => {
      const existing = s.dms.get(dm.id);
      if (!existing) return {};
      const dms = new Map(s.dms);
      dms.set(dm.id, { ...existing, ...dm });
      return { dms };
    });
  },

  addDmParticipant(dmId, participant) {
    set((s) => {
      const dm = s.dms.get(dmId);
      if (!dm) return {};
      const dms = new Map(s.dms);
      const participants = [...(dm.participants ?? []), { ...participant, dmConversationId: dmId }];
      dms.set(dmId, { ...dm, participants });
      return { dms };
    });
  },

  removeDmParticipant(dmId, userId) {
    set((s) => {
      const dm = s.dms.get(dmId);
      if (!dm) return {};
      const dms = new Map(s.dms);
      const participants = (dm.participants ?? []).filter((p) => p.userId !== userId);
      dms.set(dmId, { ...dm, participants });
      return { dms };
    });
  },

  addVoiceState(vs) {
    set((s) => ({
      voiceStates: [...s.voiceStates.filter((v) => v.userId !== vs.userId), vs],
    }));
  },

  removeVoiceState(userId) {
    set((s) => ({
      voiceStates: s.voiceStates.filter((v) => v.userId !== userId),
    }));
  },
}));
