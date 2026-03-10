import { toUserSummary, type UserSummary } from "../users/users.mapper.js";

type ReactionInput = {
  id: string;
  emoji: string;
  userId: string;
};

type AttachmentInput = {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
};

type ReplyToInput = {
  id: string;
  content: string;
  deletedAt: Date | null;
  author: { id: string; username: string; avatar: string | null };
};

type MessageInput = {
  id: string;
  type: string;
  content: string;
  authorId: string;
  channelId?: string | null;
  dmConversationId?: string | null;
  createdAt: Date;
  editedAt: Date | null;
  replyToId?: string | null;
  author: { id: string; username: string; avatar: string | null };
  reactions: ReactionInput[];
  attachments: AttachmentInput[];
  replyTo?: ReplyToInput | null;
};

export function toReactionResponse(reaction: ReactionInput) {
  return {
    id: reaction.id,
    emoji: reaction.emoji,
    userId: reaction.userId,
  };
}

export function toAttachmentResponse(attachment: AttachmentInput) {
  return {
    id: attachment.id,
    url: attachment.url,
    filename: attachment.filename,
    size: attachment.size,
    mimeType: attachment.mimeType,
  };
}

export function toMessageResponse(message: MessageInput) {
  const replyTo = message.replyTo ?? null;

  return {
    id: message.id,
    type: message.type,
    content: message.content,
    authorId: message.authorId,
    channelId: message.channelId ?? null,
    dmConversationId: message.dmConversationId ?? null,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    replyToId: message.replyToId ?? null,
    replyTo: replyTo
      ? replyTo.deletedAt
        ? { id: replyTo.id, deleted: true, content: null, author: null }
        : { id: replyTo.id, deleted: false, content: replyTo.content, author: toUserSummary(replyTo.author) }
      : null,
    author: toUserSummary(message.author),
    reactions: message.reactions.map(toReactionResponse),
    attachments: message.attachments.map(toAttachmentResponse),
  };
}

/** Minimal response for edit operations — the client already has the full message. */
export function toMessageEditResponse(message: {
  id: string;
  content: string;
  editedAt: Date | null;
}) {
  return {
    id: message.id,
    content: message.content,
    editedAt: message.editedAt,
  };
}

export type ReactionResponse = ReturnType<typeof toReactionResponse>;
export type AttachmentResponse = ReturnType<typeof toAttachmentResponse>;
export type MessageResponse = ReturnType<typeof toMessageResponse>;
export type MessageEditResponse = ReturnType<typeof toMessageEditResponse>;
export type { UserSummary };
