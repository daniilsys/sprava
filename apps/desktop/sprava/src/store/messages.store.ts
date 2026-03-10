import { create } from "zustand";
import { api } from "../lib/api";
import {
  getCachedMessages,
  cacheMessages,
  cacheSingleMessage,
  removeCachedMessage,
} from "../lib/messageCache";
import type { Message, Reaction } from "../types/models";

interface MessagesState {
  messagesByContext: Map<string, Message[]>;
  hasMore: Map<string, boolean>;
  loading: Map<string, boolean>;
  jumpedMessageId: string | null;
  isJumped: Map<string, boolean>;

  loadMessages(contextId: string, type: "channel" | "dm"): Promise<void>;
  loadMoreMessages(contextId: string, type: "channel" | "dm"): Promise<void>;
  loadAroundMessage(
    contextId: string,
    type: "channel" | "dm",
    messageId: string,
  ): Promise<void>;
  jumpToPresent(contextId: string, type: "channel" | "dm"): Promise<void>;
  addMessage(contextId: string, message: Message): void;
  editMessage(
    contextId: string,
    messageId: string,
    content: string,
    editedAt: string,
  ): void;
  deleteMessage(contextId: string, messageId: string): void;
  addReaction(contextId: string, messageId: string, reaction: Reaction): void;
  removeReaction(
    contextId: string,
    messageId: string,
    reactionId: string,
  ): void;
  sendMessage(
    contextId: string,
    type: "channel" | "dm",
    content: string,
    replyToId?: string,
  ): Promise<void>;
}

const LIMIT = 50;

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messagesByContext: new Map(),
  hasMore: new Map(),
  loading: new Map(),
  jumpedMessageId: null,
  isJumped: new Map(),

  async loadMessages(contextId, type) {
    if (get().loading.get(contextId)) return;
    if (get().messagesByContext.has(contextId)) return;

    set((s) => {
      const loading = new Map(s.loading);
      loading.set(contextId, true);
      return { loading };
    });

    // Show cached messages instantly while fetching from API
    try {
      const cached = (await getCachedMessages(contextId, LIMIT)) as Message[];
      if (cached.length > 0 && !get().messagesByContext.has(contextId)) {
        set((s) => {
          const messagesByContext = new Map(s.messagesByContext);
          const hasMore = new Map(s.hasMore);
          messagesByContext.set(contextId, cached);
          hasMore.set(contextId, cached.length === LIMIT);
          return { messagesByContext, hasMore };
        });
      }
    } catch {
      // Cache read failed — continue with API fetch
    }

    try {
      const fetcher =
        type === "channel" ? api.channels.getMessages : api.dm.getMessages;
      const messages = (await fetcher(
        contextId,
        undefined,
        LIMIT,
      )) as Message[];

      set((s) => {
        const messagesByContext = new Map(s.messagesByContext);
        const hasMore = new Map(s.hasMore);
        const loading = new Map(s.loading);
        messagesByContext.set(contextId, messages);
        hasMore.set(contextId, messages.length === LIMIT);
        loading.set(contextId, false);
        return { messagesByContext, hasMore, loading };
      });

      // Update cache in background
      cacheMessages(contextId, messages).catch(() => {});
    } catch {
      set((s) => {
        const loading = new Map(s.loading);
        loading.set(contextId, false);
        return { loading };
      });
    }
  },

  async loadMoreMessages(contextId, type) {
    if (get().loading.get(contextId)) return;
    if (!get().hasMore.get(contextId)) return;

    const existing = get().messagesByContext.get(contextId);
    if (!existing?.length) return;

    const oldestId = existing[0].id;

    set((s) => {
      const loading = new Map(s.loading);
      loading.set(contextId, true);
      return { loading };
    });

    try {
      const fetcher =
        type === "channel" ? api.channels.getMessages : api.dm.getMessages;
      const older = (await fetcher(contextId, oldestId, LIMIT)) as Message[];

      set((s) => {
        const messagesByContext = new Map(s.messagesByContext);
        const hasMore = new Map(s.hasMore);
        const loading = new Map(s.loading);
        const current = messagesByContext.get(contextId) || [];
        messagesByContext.set(contextId, [...older, ...current]);
        hasMore.set(contextId, older.length === LIMIT);
        loading.set(contextId, false);
        return { messagesByContext, hasMore, loading };
      });

      // Cache older messages in background
      cacheMessages(contextId, older).catch(() => {});
    } catch {
      set((s) => {
        const loading = new Map(s.loading);
        loading.set(contextId, false);
        return { loading };
      });
    }
  },

  async loadAroundMessage(contextId, type, messageId) {
    set((s) => {
      const loading = new Map(s.loading);
      loading.set(contextId, true);
      return { loading };
    });

    try {
      const fetcher =
        type === "channel" ? api.channels.getMessages : api.dm.getMessages;
      const messages = (await fetcher(
        contextId,
        undefined,
        LIMIT,
        messageId,
      )) as Message[];

      set((s) => {
        const messagesByContext = new Map(s.messagesByContext);
        const hasMore = new Map(s.hasMore);
        const loading = new Map(s.loading);
        const isJumped = new Map(s.isJumped);
        messagesByContext.set(contextId, messages);
        hasMore.set(contextId, true);
        loading.set(contextId, false);
        isJumped.set(contextId, true);
        return {
          messagesByContext,
          hasMore,
          loading,
          isJumped,
          jumpedMessageId: messageId,
        };
      });
    } catch {
      set((s) => {
        const loading = new Map(s.loading);
        loading.set(contextId, false);
        return { loading };
      });
    }
  },

  async jumpToPresent(contextId, type) {
    set((s) => {
      const messagesByContext = new Map(s.messagesByContext);
      const isJumped = new Map(s.isJumped);
      messagesByContext.delete(contextId);
      isJumped.delete(contextId);
      return { messagesByContext, isJumped, jumpedMessageId: null };
    });

    await get().loadMessages(contextId, type);
  },

  addMessage(contextId, message) {
    set((s) => {
      const messagesByContext = new Map(s.messagesByContext);
      const current = messagesByContext.get(contextId) || [];
      if (current.some((m) => m.id === message.id && !m.pending)) return s;
      // Replace optimistic message if this is the server response
      const pendingIdx = current.findIndex(
        (m) =>
          m.pending &&
          m.authorId === message.authorId &&
          m.content === message.content,
      );
      if (pendingIdx >= 0) {
        const updated = [...current];
        updated[pendingIdx] = message;
        messagesByContext.set(contextId, updated);
      } else {
        messagesByContext.set(contextId, [...current, message]);
      }
      return { messagesByContext };
    });

    // Cache the new message in background (skip pending/optimistic)
    if (!message.pending) {
      cacheSingleMessage(contextId, message).catch(() => {});
    }
  },

  editMessage(contextId, messageId, content, editedAt) {
    set((s) => {
      const messagesByContext = new Map(s.messagesByContext);
      const current = messagesByContext.get(contextId);
      if (!current) return s;
      messagesByContext.set(
        contextId,
        current.map((m) =>
          m.id === messageId ? { ...m, content, editedAt } : m,
        ),
      );
      return { messagesByContext };
    });
  },

  deleteMessage(contextId, messageId) {
    set((s) => {
      const messagesByContext = new Map(s.messagesByContext);
      const current = messagesByContext.get(contextId);
      if (!current) return s;
      messagesByContext.set(
        contextId,
        current.filter((m) => m.id !== messageId),
      );
      return { messagesByContext };
    });

    // Remove from cache in background
    removeCachedMessage(messageId).catch(() => {});
  },

  addReaction(contextId, messageId, reaction) {
    set((s) => {
      const messagesByContext = new Map(s.messagesByContext);
      const current = messagesByContext.get(contextId);
      if (!current) return s;
      messagesByContext.set(
        contextId,
        current.map((m) =>
          m.id === messageId
            ? { ...m, reactions: [...m.reactions, reaction] }
            : m,
        ),
      );
      return { messagesByContext };
    });
  },

  removeReaction(contextId, messageId, reactionId) {
    set((s) => {
      const messagesByContext = new Map(s.messagesByContext);
      const current = messagesByContext.get(contextId);
      if (!current) return s;
      messagesByContext.set(
        contextId,
        current.map((m) =>
          m.id === messageId
            ? {
                ...m,
                reactions: m.reactions.filter((r) => r.id !== reactionId),
              }
            : m,
        ),
      );
      return { messagesByContext };
    });
  },

  async sendMessage(contextId, type, content, replyToId) {
    const body: Record<string, unknown> = { content };
    if (replyToId) body.replyToId = replyToId;
    if (type === "channel") {
      await api.channels.sendMessage(contextId, body);
    } else {
      await api.dm.sendMessage(contextId, body);
    }
  },
}));
