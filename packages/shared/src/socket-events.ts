/**
 * Normalized Socket.io event names and payload types for Sprava.
 *
 * Usage (server):
 *   import type { Server } from "socket.io";
 *   import type { ServerToClientEvents, ClientToServerEvents } from "@sprava/shared";
 *   const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);
 *
 * Usage (client):
 *   import { io } from "socket.io-client";
 *   import type { ServerToClientEvents, ClientToServerEvents } from "@sprava/shared";
 *   const socket = io<ServerToClientEvents, ClientToServerEvents>(url);
 */

// ─── Shared payload shapes ────────────────────────────────────────────────────

export interface SocketUser {
  id: string;
  username: string;
  avatar: string | null;
}

export interface SocketAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface SocketReaction {
  id: string;
  emoji: string;
  userId: string;
}

export interface SocketReplyTo {
  id: string;
  deleted: boolean;
  /** null when the original message has been deleted */
  content: string | null;
  /** null when the original message has been deleted */
  author: SocketUser | null;
}

export interface SocketMessage {
  id: string;
  type: string;
  content: string;
  authorId: string;
  createdAt: Date;
  editedAt: Date | null;
  replyToId: string | null;
  replyTo: SocketReplyTo | null;
  author: SocketUser;
  reactions: SocketReaction[];
  attachments: SocketAttachment[];
}

export interface SocketChannel {
  id: string;
  name: string;
  type: string;
  position: number;
  serverId: string;
  lastMessageId?: string | null;
}

export interface SocketRole {
  id: string;
  name: string;
  color: string | null;
  serverId: string;
  permissions: string; // BigInt serialized as string
  position: number;
}

export interface SocketMember {
  userId: string;
  serverId: string;
  joinedAt: Date;
}

export interface SocketServer {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  inviteCode: string;
  ownerId: string;
  createdAt: Date;
  channels?: SocketChannel[];
  roles?: SocketRole[];
  members?: SocketMember[];
}

export interface SocketDm {
  id: string;
  type: string;
  name: string | null;
  icon: string | null;
  ownerId: string | null;
  createdAt: Date;
  participants?: Array<{ userId: string; dmConversationId: string }>;
  lastMessageId?: string | null;
}

export interface SocketFriendship {
  id: string;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  createdAt: Date;
  sender: SocketUser;
  receiver: SocketUser;
}

export interface SocketReadState {
  channelId: string | null;
  dmConversationId: string | null;
  lastReadMessageId: string;
}

export interface SocketVoiceState {
  userId: string;
  /** "channel:{channelId}" or "dm:{dmConversationId}" */
  roomId: string;
}

// ─── Server → Client events ───────────────────────────────────────────────────

export interface ServerToClientEvents {
  /**
   * Emitted once on connect — full initial state for the client to hydrate from.
   */
  ready: (payload: {
    user: object | null;
    servers: SocketServer[];
    friendships: SocketFriendship[];
    dms: SocketDm[];
    readStates: SocketReadState[];
    voiceStates: SocketVoiceState[];
  }) => void;

  // ── Channels ──────────────────────────────────────────────────────────────

  /** A new channel was created in a server the client is a member of. */
  "channel:created": (payload: { channel: SocketChannel }) => void;

  /** A channel's metadata (name, type, position) was updated. */
  "channel:updated": (payload: { channel: SocketChannel }) => void;

  /** A channel was deleted. */
  "channel:deleted": (payload: { channelId: string; serverId: string }) => void;

  /** A new message was posted in a channel. */
  "channel:message_new": (payload: { message: SocketMessage }) => void;

  /** A message in a channel was edited. */
  "channel:message_edit": (payload: {
    id: string;
    content: string;
    editedAt: Date | null;
    channelId: string;
  }) => void;

  /** A message in a channel was soft-deleted. */
  "channel:message_delete": (payload: {
    messageId: string;
    channelId: string;
  }) => void;

  /** A user started or stopped typing in a channel. */
  "channel:typing": (payload: {
    userId: string;
    channelId: string;
    typing: boolean;
  }) => void;

  /** A reaction was added to a channel message. */
  "channel:reaction_add": (payload: {
    messageId: string;
    channelId: string;
    reaction: SocketReaction;
  }) => void;

  /** A reaction was removed from a channel message. */
  "channel:reaction_remove": (payload: {
    messageId: string;
    channelId: string;
    reaction: SocketReaction;
  }) => void;

  // ── Direct messages ───────────────────────────────────────────────────────

  /** A new DM conversation (1-1 or group) was created. */
  "dm:created": (payload: { dm: SocketDm }) => void;

  /** A new message was posted in a DM conversation. */
  "dm:message_new": (payload: {
    message: SocketMessage;
    dmConversationId: string;
  }) => void;

  /** A message in a DM was edited. */
  "dm:message_edit": (payload: {
    id: string;
    content: string;
    editedAt: Date | null;
    dmConversationId: string;
  }) => void;

  /** A message in a DM was soft-deleted. */
  "dm:message_delete": (payload: {
    messageId: string;
    dmConversationId: string;
  }) => void;

  /** A user started or stopped typing in a DM conversation. */
  "dm:typing": (payload: {
    userId: string;
    dmConversationId: string;
    typing: boolean;
  }) => void;

  /** A reaction was added to a DM message. */
  "dm:reaction_add": (payload: {
    messageId: string;
    dmConversationId: string;
    reaction: SocketReaction;
  }) => void;

  /** A reaction was removed from a DM message. */
  "dm:reaction_remove": (payload: {
    messageId: string;
    dmConversationId: string;
    reaction: SocketReaction;
  }) => void;

  // ── Servers ───────────────────────────────────────────────────────────────

  /** A user joined a server. */
  "server:member_join": (payload: {
    serverId: string;
    userId: string;
    member: SocketMember;
  }) => void;

  /** A user left or was removed from a server. */
  "server:member_leave": (payload: {
    serverId: string;
    userId: string;
  }) => void;

  /** Server ownership was transferred to another member. */
  "server:ownership_transferred": (payload: {
    serverId: string;
    newOwnerId: string;
  }) => void;

  // ── Users ─────────────────────────────────────────────────────────────────

  /** A user's online/offline status changed. */
  "user:presence": (payload: { userId: string; online: boolean }) => void;

  // ── Voice ─────────────────────────────────────────────────────────────────

  /** Sent to the joining client after a successful voice:join. */
  "voice:joined": (payload: {
    transportParams: unknown;
    routerRtpCapabilities: unknown;
    existingProducers: unknown[];
    voiceStates: SocketVoiceState[];
  }) => void;

  /** Confirmation that the client successfully left voice. */
  "voice:left": () => void;

  /** Another user joined the same voice room. */
  "voice:user_joined": (payload: { userId: string; roomId: string }) => void;

  /** A user left (or was disconnected from) the voice room. */
  "voice:user_left": (payload: { userId: string; roomId: string }) => void;

  /** Transport DTLS handshake accepted by the SFU. */
  "voice:transport_ok": () => void;

  /** The SFU created a Producer — returns the assigned producerId. */
  "voice:produce_ok": (payload: { producerId: string }) => void;

  /** A new media producer appeared in the room (other clients should consume it). */
  "voice:new_producer": (payload: {
    producerId: string;
    userId: string;
    kind: string;
  }) => void;

  /** The SFU created a Consumer — client can start receiving the track. */
  "voice:consumer_ready": (payload: {
    consumerId: string;
    producerId: string;
    kind: string;
    rtpParameters: unknown;
  }) => void;

  /** A voice operation failed. */
  "voice:error": (payload: { code: string; message: string }) => void;

  /** Someone started a voice call in a DM conversation. */
  "voice:dm_call_incoming": (payload: {
    dmConversationId: string;
    callerId: string;
  }) => void;

  /** The DM voice call ended (no more participants). */
  "voice:dm_call_ended": (payload: { dmConversationId: string }) => void;
}

// ─── Client → Server events ───────────────────────────────────────────────────

export interface ClientToServerEvents {
  /** Client started typing in a channel or DM. */
  "typing:start": (payload: {
    channelId?: string;
    dmConversationId?: string;
  }) => void;

  /** Client stopped typing in a channel or DM. */
  "typing:stop": (payload: {
    channelId?: string;
    dmConversationId?: string;
  }) => void;

  /** Client acknowledged reading up to a message in a channel. */
  "channel:read": (payload: {
    channelId: string;
    lastReadMessageId: string;
  }) => void;

  /** Client acknowledged reading up to a message in a DM conversation. */
  "dm:read": (payload: {
    dmConversationId: string;
    lastReadMessageId: string;
  }) => void;

  // ── Voice ─────────────────────────────────────────────────────────────────

  /** Join a voice channel or start/join a DM voice call. */
  "voice:join": (payload: {
    channelId?: string;
    dmConversationId?: string;
  }) => void;

  /** Leave the current voice room. */
  "voice:leave": () => void;

  /** Complete the WebRTC DTLS handshake for the send transport. */
  "voice:connect_transport": (payload: {
    transportId: string;
    dtlsParameters: unknown;
  }) => void;

  /** Ask the SFU to create a Producer for a local track. */
  "voice:produce": (payload: {
    transportId: string;
    kind: string;
    rtpParameters: unknown;
  }) => void;

  /** Ask the SFU to create a Consumer for a remote producer. */
  "voice:consume_request": (payload: {
    producerId: string;
    rtpCapabilities: unknown;
  }) => void;
}

// ─── Event name constants ─────────────────────────────────────────────────────

/**
 * Normalized event name constants — use these instead of raw strings
 * to avoid typos and enable easy refactoring.
 *
 * @example
 * socket.emit(SocketEvent.CHANNEL_MESSAGE_NEW, { message });
 * socket.on(SocketEvent.TYPING_START, handler);
 */
export const SocketEvent = {
  READY: "ready",

  CHANNEL_CREATED: "channel:created",
  CHANNEL_UPDATED: "channel:updated",
  CHANNEL_DELETED: "channel:deleted",
  CHANNEL_MESSAGE_NEW: "channel:message_new",
  CHANNEL_MESSAGE_EDIT: "channel:message_edit",
  CHANNEL_MESSAGE_DELETE: "channel:message_delete",
  CHANNEL_TYPING: "channel:typing",
  CHANNEL_REACTION_ADD: "channel:reaction_add",
  CHANNEL_REACTION_REMOVE: "channel:reaction_remove",

  DM_CREATED: "dm:created",
  DM_MESSAGE_NEW: "dm:message_new",
  DM_MESSAGE_EDIT: "dm:message_edit",
  DM_MESSAGE_DELETE: "dm:message_delete",
  DM_TYPING: "dm:typing",
  DM_REACTION_ADD: "dm:reaction_add",
  DM_REACTION_REMOVE: "dm:reaction_remove",

  SERVER_MEMBER_JOIN: "server:member_join",
  SERVER_MEMBER_LEAVE: "server:member_leave",
  SERVER_OWNERSHIP_TRANSFERRED: "server:ownership_transferred",

  USER_PRESENCE: "user:presence",

  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",
  CHANNEL_READ: "channel:read",
  DM_READ: "dm:read",

  VOICE_JOINED: "voice:joined",
  VOICE_LEFT: "voice:left",
  VOICE_USER_JOINED: "voice:user_joined",
  VOICE_USER_LEFT: "voice:user_left",
  VOICE_TRANSPORT_OK: "voice:transport_ok",
  VOICE_PRODUCE_OK: "voice:produce_ok",
  VOICE_NEW_PRODUCER: "voice:new_producer",
  VOICE_CONSUMER_READY: "voice:consumer_ready",
  VOICE_ERROR: "voice:error",
  VOICE_DM_CALL_INCOMING: "voice:dm_call_incoming",
  VOICE_DM_CALL_ENDED: "voice:dm_call_ended",

  VOICE_JOIN: "voice:join",
  VOICE_LEAVE: "voice:leave",
  VOICE_CONNECT_TRANSPORT: "voice:connect_transport",
  VOICE_PRODUCE: "voice:produce",
  VOICE_CONSUME_REQUEST: "voice:consume_request",
} as const satisfies Record<string, keyof ServerToClientEvents | keyof ClientToServerEvents>;

export type SocketEventName = (typeof SocketEvent)[keyof typeof SocketEvent];
