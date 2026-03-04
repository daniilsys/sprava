import {
  toChannelResponse,
  type ChannelResponse,
} from "../channels/channels.mapper.js";
import { toRoleResponse, type RoleResponse } from "../roles/roles.mapper.js";

type MemberInput = {
  userId: string;
  serverId: string;
  joinedAt: Date;
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
    messages?: Array<{ id: string }>;
  }>;
  roles?: Array<{
    id: string;
    name: string;
    color: string | null;
    serverId: string;
    permissions: bigint;
    position: number;
  }>;
  members?: MemberInput[];
};

type ServerBanInput = {
  userId: string;
  serverId: string;
  reason: string | null;
  bannedAt: Date;
};

export function toServerBanResponse(ban: ServerBanInput) {
  return {
    userId: ban.userId,
    serverId: ban.serverId,
    reason: ban.reason,
    bannedAt: ban.bannedAt,
  };
}

export function toMemberResponse(member: MemberInput) {
  return {
    userId: member.userId,
    serverId: member.serverId,
    joinedAt: member.joinedAt,
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
