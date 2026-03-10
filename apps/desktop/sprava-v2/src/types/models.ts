export interface User {
  id: string;
  username: string;
  avatar: string | null;
}

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  avatar: string | null;
  verified: boolean;
  createdAt: string;
  profile?: {
    bio?: string | null;
    location?: string | null;
    website?: string | null;
  } | null;
}

export interface Attachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
}

export interface ReplyTo {
  id: string;
  deleted: boolean;
  content: string | null;
  author: User | null;
}

export interface Message {
  id: string;
  type: string;
  content: string;
  authorId: string;
  createdAt: string;
  editedAt: string | null;
  replyToId: string | null;
  replyTo: ReplyTo | null;
  author: User;
  reactions: Reaction[];
  attachments: Attachment[];
  channelId?: string;
  dmConversationId?: string;
  // Optimistic sending state
  pending?: boolean;
  failed?: boolean;
  clientId?: string;
}

export interface Channel {
  id: string;
  name: string;
  type: string;
  position: number;
  serverId: string;
  parentId?: string | null;
  syncParentRules?: boolean;
  lastMessageId?: string | null;
}

export interface ChannelRule {
  id: string;
  channelId: string;
  roleId: string | null;
  memberId: string | null;
  allow: string; // BigInt as string
  deny: string;  // BigInt as string
}

export interface Role {
  id: string;
  name: string;
  color: string | null;
  serverId: string;
  permissions: string;
  position: number;
  isWorld?: boolean;
  separate?: boolean;
}

export interface Member {
  userId: string;
  serverId: string;
  joinedAt: string;
  user?: User;
  roleIds?: string[];
}

export interface Server {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  channels?: Channel[];
  roles?: Role[];
  members?: Member[];
}

export interface DmConversation {
  id: string;
  type: string;
  name: string | null;
  icon: string | null;
  ownerId: string | null;
  createdAt: string;
  participants?: Array<{ userId: string; dmConversationId: string; user?: User }>;
  lastMessageId?: string | null;
}

export interface Friendship {
  id: string;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  createdAt: string;
  sender: User;
  receiver: User;
}

export interface ReadState {
  channelId: string | null;
  dmConversationId: string | null;
  lastReadMessageId: string;
}

export interface Pin {
  id: string;
  messageId: string;
  channelId: string | null;
  dmConversationId: string | null;
  pinnedById: string;
  pinnedAt: string;
  message: Message;
  pinnedBy: User;
}

export interface AuditLogEntry {
  id: string;
  serverId: string;
  userId: string;
  actionType: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: User;
  target: { id: string; username: string; avatar: string | null } | null;
}

export type UserStatus = "online" | "idle" | "dnd" | "offline";

export interface PresenceState {
  status: UserStatus;
  statusMessage: string;
}

export interface VoiceState {
  userId: string;
  roomId: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
}

export interface ReadyPayload {
  user: User;
  servers: Server[];
  friendships: Friendship[];
  dms: DmConversation[];
  readStates: ReadState[];
  voiceStates: VoiceState[];
  memberRoleIds?: Record<string, string[]>;
  presenceStates?: Record<string, PresenceState>;
  channelRules?: ChannelRule[];
}
