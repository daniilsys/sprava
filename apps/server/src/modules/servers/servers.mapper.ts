import {
  toChannelResponse,
  type ChannelResponse,
} from "../channels/channels.mapper.js";
import { toRoleResponse, type RoleResponse } from "../roles/roles.mapper.js";

type MemberInput = {
  userId: string;
  serverId: string;
  joinedAt: Date;
  user?: {
    id: string;
    username: string;
    avatar: string | null;
    memberRoles?: { roleId: string }[];
  } | null;
};

type ServerInput = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  inviteCode: string;
  ownerId: string;
  createdAt: Date;
  channels?: Array<{
    id: string;
    name: string;
    type: string;
    position: number;
    serverId: string;
    parentId?: string | null;
    messages?: Array<{ id: string }>;
  }>;
  roles?: Array<{
    id: string;
    name: string;
    color: string | null;
    serverId: string;
    permissions: bigint;
    position: number;
    isWorld: boolean;
    separate: boolean;
  }>;
  members?: MemberInput[];
};

type ServerBanInput = {
  userId: string;
  serverId: string;
  reason: string | null;
  bannedAt: Date;
  user?: { username: string; avatar: string | null };
};

export function toServerBanResponse(ban: ServerBanInput) {
  return {
    userId: ban.userId,
    serverId: ban.serverId,
    reason: ban.reason,
    bannedAt: ban.bannedAt,
    username: ban.user?.username ?? "Unknown",
    avatar: ban.user?.avatar ?? null,
  };
}

export function toMemberResponse(member: MemberInput) {
  return {
    userId: member.userId,
    serverId: member.serverId,
    joinedAt: member.joinedAt,
    user: member.user
      ? {
          id: member.user.id,
          username: member.user.username,
          avatar: member.user.avatar,
        }
      : undefined,
    roleIds: member.user?.memberRoles?.map((mr) => mr.roleId),
  };
}

export function toServerResponse(server: ServerInput) {
  return {
    id: server.id,
    name: server.name,
    description: server.description,
    icon: server.icon,
    inviteCode: server.inviteCode,
    ownerId: server.ownerId,
    createdAt: server.createdAt,
    channels: server.channels?.map(toChannelResponse),
    roles: server.roles?.map(toRoleResponse),
    members: server.members?.map(toMemberResponse),
  };
}

export type MemberResponse = ReturnType<typeof toMemberResponse>;
export type ServerResponse = ReturnType<typeof toServerResponse>;
export type { ChannelResponse, RoleResponse };
