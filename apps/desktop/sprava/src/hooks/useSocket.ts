import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { createSocket, disconnectSocket, getSocket } from "../lib/socket";
import { useAuthStore } from "../store/auth.store";
import { useAppStore } from "../store/app.store";
import { useMessagesStore } from "../store/messages.store";
import { useFriendsStore } from "../store/friends.store";
import {
  handleVoiceUserJoined,
  handleVoiceUserLeft,
  handleVoiceNewProducer,
  handleVoiceVideoStart,
  handleVoiceVideoStop,
  forceDisconnect,
} from "../lib/voice";
import { useVoiceStore } from "../store/voice.store";
import { usePermissionsStore } from "../store/permissions.store";
import { useUIStore } from "../store/ui.store";
import { notifyMessage } from "../lib/notifications";
import type { ReadyPayload, Message, Channel, Member, Reaction, Role, Friendship, DmConversation } from "../types/models";

/** When a message is deleted, update lastMessageId if it was the last message */
function fixLastMessageIdOnDelete(contextId: string, deletedMessageId: string) {
  const appState = useAppStore.getState();
  const channel = appState.channels.get(contextId);
  const dm = appState.dms.get(contextId);
  const currentLastId = channel?.lastMessageId ?? dm?.lastMessageId;
  if (currentLastId !== deletedMessageId) return;

  const msgs = useMessagesStore.getState().messagesByContext.get(contextId);
  const remaining = msgs?.filter((m) => m.id !== deletedMessageId);
  const newLastId = remaining && remaining.length > 0 ? remaining[remaining.length - 1].id : null;

  appState.updateLastMessageId(contextId, newLastId);
  if (newLastId) {
    appState.markRead(contextId, newLastId);
  }
}

/**
 * P0: Subscribe to presence for friends + DM participants after ready.
 * Also emits channel:focus for the initially active channel (P2).
 */
function emitInitialSubscriptions(socket: Socket, data: ReadyPayload) {
  const currentUserId = data.user.id;
  const userIds = new Set<string>();

  // Friends
  for (const f of data.friendships) {
    if (f.status === "ACCEPTED") {
      const friendId = f.sender.id === currentUserId ? f.receiver.id : f.sender.id;
      userIds.add(friendId);
    }
  }

  // DM participants
  for (const dm of data.dms) {
    if (dm.participants) {
      for (const p of dm.participants) {
        if (p.userId !== currentUserId) userIds.add(p.userId);
      }
    }
  }

  if (userIds.size > 0) {
    socket.emit("presence:subscribe", { userIds: Array.from(userIds) });
  }

  // P2: Focus the currently active channel
  const activeChannelId = useUIStore.getState().activeChannelId;
  if (activeChannelId) {
    socket.emit("channel:focus", { channelId: activeChannelId });
  }
}

export function useSocket(
  onIncomingCall?: (data: { dmConversationId: string; callerId: string }) => void,
  onCallEnded?: (data: { dmConversationId: string }) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const onIncomingCallRef = useRef(onIncomingCall);
  onIncomingCallRef.current = onIncomingCall;
  const onCallEndedRef = useRef(onCallEnded);
  onCallEndedRef.current = onCallEnded;

  useEffect(() => {
    let mounted = true;

    let prevGroupCountWasConnected = false;

    async function connect() {
      const socket = await createSocket();
      if (!mounted) return;
      socketRef.current = socket;

      socket.on("connect", () => {
        useUIStore.getState().setSocketStatus("connected");

        // On reconnect, resync active context
        if (prevGroupCountWasConnected) {
          const uiState = useUIStore.getState();
          const activeContextId = uiState.activeChannelId || uiState.activeDmId;
          if (activeContextId) {
            // Reload messages for the active context to catch anything missed
            const msgs = useMessagesStore.getState().messagesByContext.get(activeContextId);
            const lastId = msgs && msgs.length > 0 ? msgs[msgs.length - 1].id : undefined;
            if (lastId) {
              // Fetch messages after the last known one
              const isChannel = !!uiState.activeChannelId;
              const fetchFn = isChannel
                ? () => import("../lib/api").then((m) => m.api.channels.getMessages(activeContextId, undefined, 50, lastId))
                : () => import("../lib/api").then((m) => m.api.dm.getMessages(activeContextId, undefined, 50, lastId));
              fetchFn().then((result: unknown) => {
                const newMessages = result as Message[];
                if (Array.isArray(newMessages)) {
                  for (const msg of newMessages) {
                    useMessagesStore.getState().addMessage(activeContextId, msg);
                  }
                }
              }).catch(() => {/* ignore resync errors */});
            }
          }
        }
        prevGroupCountWasConnected = true;
      });

      socket.on("disconnect", () => {
        useUIStore.getState().setSocketStatus("disconnected");
      });

      socket.io.on("reconnect_attempt", () => {
        useUIStore.getState().setSocketStatus("connecting");
      });

      socket.on("ready", (data: ReadyPayload) => {
        useAppStore.getState().hydrateReady(data);
        useAuthStore.getState().setUser(data.user);
        useFriendsStore.getState().hydrate(data.friendships, data.user.id);

        // P0 + P2: Subscribe to presence + focus active channel
        emitInitialSubscriptions(socket, data);
      });

      // P0: Batch presence state response
      socket.on(
        "presence:state",
        ({ states }: { states: Record<string, { status: string; statusMessage: string }> }) => {
          const appStore = useAppStore.getState();
          for (const [uid, ps] of Object.entries(states)) {
            appStore.setPresence(uid, ps.status as import("../types/models").UserStatus, ps.statusMessage);
          }
        },
      );

      // P3: Lightweight unread notification for unfocused channels
      socket.on(
        "channel:unread_update",
        ({ channelId, messageId, authorId }: { channelId: string; messageId: string; authorId: string }) => {
          // If we're focused on this channel, ignore — we get the full message via channel:message_new
          const focusedChannelId = useUIStore.getState().activeChannelId;
          if (channelId === focusedChannelId) return;

          // Update lastMessageId for unread computation
          useAppStore.getState().updateLastMessageId(channelId, messageId);

          // If this is our own message, auto-mark as read
          if (authorId === useAuthStore.getState().user?.id) {
            useAppStore.getState().markRead(channelId, messageId);
          }
        },
      );

      // P1: Server member chunks (lazy loading response)
      socket.on(
        "server:members_chunk",
        ({ serverId, members }: { serverId: string; members: Member[]; cursor: string | null }) => {
          useAppStore.getState().appendMembers(serverId, members);
        },
      );

      // Channel events
      socket.on("channel:created", ({ channel }: { channel: Channel }) => {
        useAppStore.getState().addChannel(channel);
      });
      socket.on("channel:updated", ({ channel }: { channel: Channel }) => {
        useAppStore.getState().updateChannel(channel);
      });
      socket.on(
        "channel:deleted",
        ({ channelId, serverId }: { channelId: string; serverId: string }) => {
          useAppStore.getState().removeChannel(channelId, serverId);
        },
      );
      socket.on(
        "channel:rule_updated",
        ({ rule }: { serverId: string; rule: { id: string; channelId: string; roleId: string | null; memberId: string | null; allow: string; deny: string } }) => {
          usePermissionsStore.getState().upsertChannelRule(rule);
        },
      );
      socket.on(
        "channel:rule_deleted",
        ({ channelId, roleId, memberId }: { serverId: string; channelId: string; roleId: string | null; memberId: string | null }) => {
          usePermissionsStore.getState().deleteChannelRule(channelId, roleId, memberId);
        },
      );
      socket.on(
        "channels:reordered",
        ({ channels: reordered }: { serverId: string; channels: Array<{ id: string; position: number; parentId: string | null }> }) => {
          const store = useAppStore.getState();
          const newChannels = new Map(store.channels);
          for (const ch of reordered) {
            const existing = newChannels.get(ch.id);
            if (existing) {
              newChannels.set(ch.id, { ...existing, position: ch.position, parentId: ch.parentId });
            }
          }
          useAppStore.setState({ channels: newChannels });
        },
      );

      // Channel messages
      socket.on("channel:message_new", ({ message }: { message: Message }) => {
        const channelId = message.channelId;
        if (channelId) {
          useMessagesStore.getState().addMessage(channelId, message);
          useAppStore.getState().updateLastMessageId(channelId, message.id);
          const currentUserId = useAuthStore.getState().user?.id;
          if (message.authorId === currentUserId) {
            useAppStore.getState().markRead(channelId, message.id);
            socket.emit("channel:read", { channelId, lastReadMessageId: message.id });
          } else if (currentUserId) {
            notifyMessage({
              contextId: channelId,
              authorId: message.authorId,
              authorName: message.author.username,
              content: message.content,
              currentUserId,
              isMention: message.content.includes(`@${useAuthStore.getState().user?.username}`),
            });
          }
        }
      });
      socket.on(
        "channel:message_edit",
        (p: { id: string; content: string; editedAt: string; channelId: string }) => {
          useMessagesStore.getState().editMessage(p.channelId, p.id, p.content, p.editedAt);
        },
      );
      socket.on(
        "channel:message_delete",
        ({ messageId, channelId }: { messageId: string; channelId: string }) => {
          fixLastMessageIdOnDelete(channelId, messageId);
          useMessagesStore.getState().deleteMessage(channelId, messageId);
        },
      );

      // Reactions
      socket.on(
        "channel:reaction_add",
        (p: { messageId: string; channelId: string; reaction: Reaction }) => {
          useMessagesStore.getState().addReaction(p.channelId, p.messageId, p.reaction);
        },
      );
      socket.on(
        "channel:reaction_remove",
        (p: { messageId: string; channelId: string; reaction: Reaction }) => {
          useMessagesStore.getState().removeReaction(p.channelId, p.messageId, p.reaction.id);
        },
      );

      // DM messages
      socket.on(
        "dm:message_new",
        ({ message, dmConversationId }: { message: Message; dmConversationId: string }) => {
          useMessagesStore.getState().addMessage(dmConversationId, message);
          useAppStore.getState().updateLastMessageId(dmConversationId, message.id);
          const currentUserId = useAuthStore.getState().user?.id;
          if (message.authorId === currentUserId) {
            useAppStore.getState().markRead(dmConversationId, message.id);
            socket.emit("dm:read", { dmConversationId, lastReadMessageId: message.id });
          } else if (currentUserId) {
            notifyMessage({
              contextId: dmConversationId,
              authorId: message.authorId,
              authorName: message.author.username,
              content: message.content,
              currentUserId,
            });
          }
        },
      );
      socket.on(
        "dm:message_edit",
        (p: { id: string; content: string; editedAt: string; dmConversationId: string }) => {
          useMessagesStore.getState().editMessage(p.dmConversationId, p.id, p.content, p.editedAt);
        },
      );
      socket.on(
        "dm:message_delete",
        ({ messageId, dmConversationId }: { messageId: string; dmConversationId: string }) => {
          fixLastMessageIdOnDelete(dmConversationId, messageId);
          useMessagesStore.getState().deleteMessage(dmConversationId, messageId);
        },
      );

      // DM reactions
      socket.on(
        "dm:reaction_add",
        (p: { messageId: string; dmConversationId: string; reaction: Reaction }) => {
          useMessagesStore.getState().addReaction(p.dmConversationId, p.messageId, p.reaction);
        },
      );
      socket.on(
        "dm:reaction_remove",
        (p: { messageId: string; dmConversationId: string; reaction: Reaction }) => {
          useMessagesStore
            .getState()
            .removeReaction(p.dmConversationId, p.messageId, p.reaction.id);
        },
      );

      // DM created
      socket.on("dm:created", ({ dm }: { dm: DmConversation }) => {
        useAppStore.getState().addDm(dm);
        // Subscribe to presence for new DM participants
        const currentUserId = useAuthStore.getState().user?.id;
        if (dm.participants) {
          const newUserIds = dm.participants
            .filter((p) => p.userId !== currentUserId)
            .map((p) => p.userId);
          if (newUserIds.length > 0) {
            socket.emit("presence:subscribe", { userIds: newUserIds });
          }
        }
      });

      // DM updates
      socket.on("dm:updated", ({ dm }: { dm: Partial<DmConversation> & { id: string } }) => {
        useAppStore.getState().updateDm(dm);
      });
      socket.on(
        "dm:participant_added",
        ({ dmConversationId, participant }: { dmConversationId: string; participant: { userId: string; user?: { id: string; username: string; avatar: string | null } } }) => {
          useAppStore.getState().addDmParticipant(dmConversationId, participant);
        },
      );
      socket.on(
        "dm:participant_removed",
        ({ dmConversationId, userId }: { dmConversationId: string; userId: string }) => {
          useAppStore.getState().removeDmParticipant(dmConversationId, userId);
        },
      );
      socket.on(
        "dm:participant_left",
        ({ dmConversationId, userId }: { dmConversationId: string; userId: string }) => {
          useAppStore.getState().removeDmParticipant(dmConversationId, userId);
        },
      );

      // Server CRUD
      socket.on(
        "server:updated",
        ({ server }: { server: Partial<import("../types/models").Server> & { id: string } }) => {
          useAppStore.getState().updateServer(server);
        },
      );
      socket.on("server:deleted", ({ serverId }: { serverId: string }) => {
        useAppStore.getState().removeServer(serverId);
      });
      socket.on(
        "server:ownership_transferred",
        ({ serverId, newOwnerId }: { serverId: string; newOwnerId: string }) => {
          useAppStore.getState().updateServerOwner(serverId, newOwnerId);
        },
      );

      // Role events
      socket.on("role:created", ({ role }: { serverId: string; role: Role }) => {
        useAppStore.getState().addRole(role);
      });
      socket.on("role:updated", ({ role }: { serverId: string; role: Role }) => {
        useAppStore.getState().updateRole(role);
      });
      socket.on("role:deleted", ({ roleId }: { serverId: string; roleId: string }) => {
        useAppStore.getState().removeRole(roleId);
      });
      socket.on("role:assigned", ({ serverId, roleId, userId }: { serverId: string; roleId: string; userId: string }) => {
        useAppStore.getState().addMemberRole(serverId, userId, roleId);
      });
      socket.on("role:removed", ({ serverId, roleId, userId }: { serverId: string; roleId: string; userId: string }) => {
        useAppStore.getState().removeMemberRole(serverId, userId, roleId);
      });
      socket.on("role:self_assigned", ({ serverId, roleId }: { serverId: string; roleId: string }) => {
        usePermissionsStore.getState().addRole(serverId, roleId);
      });
      socket.on("role:self_removed", ({ serverId, roleId }: { serverId: string; roleId: string }) => {
        usePermissionsStore.getState().removeRole(serverId, roleId);
      });

      // Friendship events
      socket.on("friendship:request_received", ({ friendship }: { friendship: Friendship }) => {
        const currentUserId = useAuthStore.getState().user?.id;
        if (currentUserId) useFriendsStore.getState().addFriendship(friendship, currentUserId);
      });
      socket.on("friendship:request_sent", ({ friendship }: { friendship: Friendship }) => {
        const currentUserId = useAuthStore.getState().user?.id;
        if (currentUserId) useFriendsStore.getState().addFriendship(friendship, currentUserId);
      });
      socket.on("friendship:accepted", ({ friendship }: { friendship: Friendship }) => {
        const currentUserId = useAuthStore.getState().user?.id;
        if (currentUserId) {
          useFriendsStore.getState().updateFriendshipStatus(friendship, currentUserId);
          // Subscribe to the new friend's presence
          const friendId = friendship.sender.id === currentUserId ? friendship.receiver.id : friendship.sender.id;
          socket.emit("presence:subscribe", { userIds: [friendId] });
        }
      });
      socket.on("friendship:cancelled", ({ friendshipId }: { friendshipId: string }) => {
        useFriendsStore.getState().removeFriendshipById(friendshipId);
      });
      socket.on("friendship:rejected", ({ friendshipId }: { friendshipId: string }) => {
        useFriendsStore.getState().removeFriendshipById(friendshipId);
      });
      socket.on("friendship:removed", ({ friendshipId }: { friendshipId: string }) => {
        useFriendsStore.getState().removeFriendshipById(friendshipId);
      });
      socket.on("friendship:blocked", ({ friendship }: { friendship: Friendship }) => {
        const currentUserId = useAuthStore.getState().user?.id;
        if (currentUserId) useFriendsStore.getState().addFriendship(friendship, currentUserId);
      });
      socket.on("friendship:unblocked", ({ friendshipId }: { friendshipId: string }) => {
        useFriendsStore.getState().removeFriendshipById(friendshipId);
      });

      // Voice error
      socket.on("voice:error", ({ code, message }: { code: string; message: string }) => {
        console.error(`Voice error [${code}]: ${message}`);
      });

      // Server members
      socket.on(
        "server:member_join",
        ({ serverId, member }: { serverId: string; userId: string; member?: Member }) => {
          if (member?.user) useAppStore.getState().addMember(serverId, member);
        },
      );
      socket.on(
        "server:member_leave",
        ({ serverId, userId }: { serverId: string; userId: string }) => {
          useAppStore.getState().removeMember(serverId, userId);
        },
      );

      // Presence
      socket.on(
        "user:presence",
        ({ userId, status, statusMessage }: { userId: string; status?: string; statusMessage?: string }) => {
          const resolvedStatus = status ?? "offline";
          useAppStore.getState().setPresence(userId, resolvedStatus as import("../types/models").UserStatus, statusMessage ?? "");
        },
      );

      // Voice events
      socket.on(
        "voice:user_joined",
        (data: { userId: string; roomId: string }) => {
          useAppStore.getState().addVoiceState(data);
          const currentUserId = useAuthStore.getState().user?.id;
          if (data.userId === currentUserId) return;
          const myRoomId = useVoiceStore.getState().currentRoomId;
          if (myRoomId && myRoomId === data.roomId) {
            handleVoiceUserJoined(data.userId);
          }
        },
      );
      socket.on(
        "voice:user_left",
        (data: { userId: string; roomId: string }) => {
          useAppStore.getState().removeVoiceState(data.userId);
          const myRoomId = useVoiceStore.getState().currentRoomId;
          if (myRoomId && myRoomId === data.roomId) {
            handleVoiceUserLeft(data.userId);
          }
        },
      );
      socket.on(
        "voice:new_producer",
        ({ producerId, userId, kind }: { producerId: string; userId: string; kind: string }) => {
          const currentUserId = useAuthStore.getState().user?.id;
          if (userId === currentUserId) return;
          handleVoiceNewProducer(producerId, userId, kind);
        },
      );
      socket.on(
        "voice:mute_state",
        ({ userId, muted }: { userId: string; muted: boolean }) => {
          useVoiceStore.getState().setPeerMuted(userId, muted);
        },
      );
      socket.on(
        "voice:deafen_state",
        ({ userId, deafened }: { userId: string; deafened: boolean }) => {
          useVoiceStore.getState().setPeerDeafened(userId, deafened);
        },
      );
      socket.on(
        "voice:video_start",
        ({ userId, kind }: { userId: string; kind: "camera" | "screen" }) => {
          const currentUserId = useAuthStore.getState().user?.id;
          if (userId === currentUserId) return;
          handleVoiceVideoStart(userId, kind);
        },
      );
      socket.on(
        "voice:video_stop",
        ({ userId, kind }: { userId: string; kind: "camera" | "screen" }) => {
          const currentUserId = useAuthStore.getState().user?.id;
          if (userId === currentUserId) return;
          handleVoiceVideoStop(userId, kind);
        },
      );
      socket.on("voice:ring_timeout", () => {
        forceDisconnect();
      });
      socket.on("voice:alone_timeout", () => {
        forceDisconnect();
      });
      socket.on(
        "voice:dm_call_incoming",
        (data: { dmConversationId: string; callerId: string }) => {
          onIncomingCallRef.current?.(data);
        },
      );
      socket.on(
        "voice:dm_call_ended",
        (data: { dmConversationId: string }) => {
          onCallEndedRef.current?.(data);
        },
      );

      socket.connect();
    }

    connect();

    // P2: Subscribe to activeChannelId changes and emit channel:focus
    let prevChannelId = useUIStore.getState().activeChannelId;
    const unsubChannelFocus = useUIStore.subscribe((state) => {
      const channelId = state.activeChannelId;
      if (channelId === prevChannelId) return;
      prevChannelId = channelId;
      const sock = getSocket();
      if (sock?.connected) {
        sock.emit("channel:focus", { channelId: channelId ?? null });
      }
    });

    return () => {
      mounted = false;
      unsubChannelFocus();
      disconnectSocket();
    };
  }, []);
}
