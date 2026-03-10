type DmParticipantInput = {
  userId: string;
  dmConversationId: string;
  user?: {
    id: string;
    username: string;
    avatar: string | null;
  } | null;
};

type DmInput = {
  id: string;
  type: string;
  name: string | null;
  icon: string | null;
  ownerId: string | null;
  createdAt: Date;
  participants?: DmParticipantInput[];
  messages?: Array<{ id: string }>;
};

type DmConversationReadStateInput = {
  userId: string;
  dmConversationId: string | null;
  lastReadMessageId: string;
};

export function toDmConversationReadStateResponse(
  readState: DmConversationReadStateInput,
) {
  return {
    userId: readState.userId,
    dmConversationId: readState.dmConversationId,
    lastReadMessageId: readState.lastReadMessageId,
  };
}

export function toDmParticipantResponse(participant: DmParticipantInput) {
  return {
    userId: participant.userId,
    dmConversationId: participant.dmConversationId,
    user: participant.user
      ? {
          id: participant.user.id,
          username: participant.user.username,
          avatar: participant.user.avatar,
        }
      : undefined,
  };
}

export function toDmResponse(dm: DmInput) {
  return {
    id: dm.id,
    type: dm.type,
    name: dm.name,
    icon: dm.icon,
    ownerId: dm.ownerId,
    createdAt: dm.createdAt,
    participants: dm.participants?.map(toDmParticipantResponse),
    lastMessageId: dm.messages?.[0]?.id ?? null,
  };
}

export type DmParticipantResponse = ReturnType<typeof toDmParticipantResponse>;
export type DmConversationReadStateResponse = ReturnType<
  typeof toDmConversationReadStateResponse
>;
export type DmResponse = ReturnType<typeof toDmResponse>;
