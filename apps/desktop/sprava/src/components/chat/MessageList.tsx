import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageGroup } from "./MessageGroup";
import { MessageListSkeleton } from "../ui/Skeleton";
import type { Message } from "../../types/models";

interface MessageListProps {
  messages: Message[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onScrollBottom?: () => void;
  highlightMessageId?: string | null;
  isJumped?: boolean;
  onJumpToPresent?: () => void;
  onJumpToMessage?: (messageId: string) => void;
}

interface MessageGroupData {
  authorId: string;
  author: Message["author"];
  firstTimestamp: string;
  messages: Message[];
}

function groupMessages(messages: Message[]): MessageGroupData[] {
  const groups: MessageGroupData[] = [];
  const FIVE_MIN = 5 * 60 * 1000;

  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const timeDiff = last
      ? new Date(msg.createdAt).getTime() -
        new Date(last.messages[last.messages.length - 1].createdAt).getTime()
      : Infinity;

    if (last && last.authorId === msg.authorId && timeDiff < FIVE_MIN) {
      last.messages.push(msg);
    } else {
      groups.push({
        authorId: msg.authorId,
        author: msg.author,
        firstTimestamp: msg.createdAt,
        messages: [msg],
      });
    }
  }

  return groups;
}

export function MessageList({
  messages,
  hasMore,
  loading,
  onLoadMore,
  onScrollBottom,
  highlightMessageId,
  isJumped,
  onJumpToPresent,
  onJumpToMessage,
}: MessageListProps) {
  const { t } = useTranslation("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevGroupCountRef = useRef(0);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const groups = useMemo(() => groupMessages(messages), [messages]);

  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 5,
    getItemKey: (index) => groups[index].messages[0].id,
  });

  // Scroll to highlighted message when jumping
  useEffect(() => {
    if (!highlightMessageId) return;
    setHighlightId(highlightMessageId);
    const groupIndex = groups.findIndex((g) =>
      g.messages.some((m) => m.id === highlightMessageId),
    );
    if (groupIndex >= 0) {
      virtualizer.scrollToIndex(groupIndex, { align: "center" });
      // Also scroll the actual message into view after virtualizer settles
      setTimeout(() => {
        const el = document.getElementById(`msg-${highlightMessageId}`);
        el?.scrollIntoView({ block: "center" });
      }, 100);
    }
    const fadeTimer = setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(fadeTimer);
  }, [highlightMessageId]);

  // Auto-scroll to bottom on new groups (new messages)
  useEffect(() => {
    if (groups.length > prevGroupCountRef.current && isAtBottomRef.current) {
      virtualizer.scrollToIndex(groups.length - 1, { align: "end" });
    }
    prevGroupCountRef.current = groups.length;
  }, [groups.length]);

  // Initial scroll to bottom
  useEffect(() => {
    if (groups.length > 0 && !highlightMessageId) {
      virtualizer.scrollToIndex(groups.length - 1, { align: "end" });
      // If content doesn't overflow, mark read now
      if (scrollRef.current && scrollRef.current.scrollHeight <= scrollRef.current.clientHeight) {
        onScrollBottom?.();
      }
    }
  }, [groups.length === 0]); // only when going from 0 to >0

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    isAtBottomRef.current = atBottom;
    if (atBottom && onScrollBottom) onScrollBottom();

    // Load more when near top
    if (scrollTop < 100 && hasMore && !loading) {
      onLoadMore();
    }
  }, [onScrollBottom, hasMore, loading, onLoadMore]);

  const totalSize = virtualizer.getTotalSize();
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-2 flex flex-col relative"
      onScroll={handleScroll}
    >
      {loading && hasMore && (
        <MessageListSkeleton />
      )}

      {!loading && messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-text-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <p className="text-sm font-medium">{t("empty.title")}</p>
          <p className="text-xs mt-1">{t("empty.subtitle")}</p>
        </div>
      )}

      {messages.length > 0 && (
        <div
          style={{
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
        <div
          style={{
            height: `${totalSize}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualRow) => {
            const group = groups[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MessageGroup
                  group={group}
                  highlightId={highlightId}
                  onJumpToMessage={onJumpToMessage}
                />
              </div>
            );
          })}
        </div>
        </div>
      )}

      {/* Jump to Present button */}
      {isJumped && onJumpToPresent && (
        <div className="sticky bottom-2 flex justify-center pointer-events-none">
          <button
            onClick={onJumpToPresent}
            className="pointer-events-auto px-4 py-1.5 text-sm font-medium bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-colors"
          >
            {t("jumpToPresent")}
          </button>
        </div>
      )}
    </div>
  );
}
