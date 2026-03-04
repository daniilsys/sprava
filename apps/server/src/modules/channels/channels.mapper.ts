type ChannelInput = {
  id: string;
  name: string;
  type: string;
  position: number;
  serverId: string;
  messages?: Array<{ id: string }>;
};

type ChannelRuleInput = {
  id: string;
  channelId: string;
  roleId: string | null;
  memberId: string | null;
  allow: bigint;
  deny: bigint;
};

type ChannelReadStateInput = {
  userId: string;
  channelId: string | null;
  lastReadMessageId: string;
};

export function toChannelResponse(channel: ChannelInput) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    position: channel.position,
    serverId: channel.serverId,
    lastMessageId: channel.messages?.[0]?.id ?? null,
  };
}

/** Serializes allow/deny BigInt fields to strings. */
export function toChannelRuleResponse(rule: ChannelRuleInput) {
  return {
    id: rule.id,
    channelId: rule.channelId,
    roleId: rule.roleId,
    memberId: rule.memberId,
    allow: rule.allow.toString(),
    deny: rule.deny.toString(),
  };
}

export function toChannelReadStateResponse(readState: ChannelReadStateInput) {
  return {
    userId: readState.userId,
    channelId: readState.channelId,
    lastReadMessageId: readState.lastReadMessageId,
  };
}

export type ChannelResponse = ReturnType<typeof toChannelResponse>;
export type ChannelRuleResponse = ReturnType<typeof toChannelRuleResponse>;
export type ChannelReadStateResponse = ReturnType<
  typeof toChannelReadStateResponse
>;
