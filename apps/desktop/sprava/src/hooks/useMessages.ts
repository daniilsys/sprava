import { useEffect, useCallback, useRef } from "react";
import { useMessagesStore } from "../store/messages.store";
import { useAppStore } from "../store/app.store";
import { getSocket } from "../lib/socket";
import type { Message } from "../types/models";

const EMPTY: Message[] = [];

export function useMessages(contextId: string | null, type: "channel" | "dm") {
  const messages = useMessagesStore((s) =>
    contextId ? s.messagesByContext.get(contextId) ?? EMPTY : EMPTY,
  );
  const hasMore = useMessagesStore((s) =>
    contextId ? s.hasMore.get(contextId) ?? false : false,
  );
  const loading = useMessagesStore((s) =>
    contextId ? s.loading.get(contextId) ?? false : false,
  );
  const isJumped = useMessagesStore((s) =>
    contextId ? s.isJumped.get(contextId) ?? false : false,
  );
  const jumpedMessageId = useMessagesStore((s) => s.jumpedMessageId);

  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (contextId && loadedRef.current !== contextId) {
      loadedRef.current = contextId;
      useMessagesStore.getState().loadMessages(contextId, type);
    }
  }, [contextId, type]);

  const loadMore = useCallback(() => {
    if (contextId) {
      useMessagesStore.getState().loadMoreMessages(contextId, type);
    }
  }, [contextId, type]);

  const jumpToMessage = useCallback((messageId: string) => {
    if (contextId) {
      useMessagesStore.getState().loadAroundMessage(contextId, type, messageId);
    }
  }, [contextId, type]);

  const jumpToPresent = useCallback(() => {
    if (contextId) {
      useMessagesStore.getState().jumpToPresent(contextId, type);
    }
  }, [contextId, type]);

  const markRead = useCallback(() => {
    if (!contextId || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    const currentRead = useAppStore.getState().readStates.get(contextId);
    if (currentRead === lastMsg.id) return;

    useAppStore.getState().markRead(contextId, lastMsg.id);
    const socket = getSocket();
    if (socket) {
      if (type === "channel") {
        socket.emit("channel:read", { channelId: contextId, lastReadMessageId: lastMsg.id });
      } else {
        socket.emit("dm:read", { dmConversationId: contextId, lastReadMessageId: lastMsg.id });
      }
    }
  }, [contextId, messages, type]);

  return { messages, hasMore, loading, loadMore, markRead, jumpToMessage, jumpToPresent, isJumped, jumpedMessageId };
}
