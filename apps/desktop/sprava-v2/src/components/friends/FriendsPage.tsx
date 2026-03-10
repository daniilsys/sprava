import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFriendsStore } from "../../store/friends.store";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { FriendsTabs, type Tab } from "./FriendsTabs";
import { FriendItem } from "./FriendItem";
import { PendingItem } from "./PendingItem";
import { AddFriendBar } from "./AddFriendBar";
import { ScrollArea } from "../ui/ScrollArea";

export function FriendsPage() {
  const { t } = useTranslation("friends");
  const [tab, setTab] = useState<Tab>("all");
  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setFocusedIndex(-1);
  };
  const currentUserId = useAuthStore((s) => s.user?.id ?? "");
  const friends = useFriendsStore((s) => s.friends);
  const pendingIncoming = useFriendsStore((s) => s.pendingIncoming);
  const pendingSent = useFriendsStore((s) => s.pendingSent);
  const presence = useAppStore((s) => s.presence);

  const onlineFriends = friends.filter((f) => {
    const friendId = f.sender.id === currentUserId ? f.receiver.id : f.sender.id;
    const ps = presence.get(friendId);
    return ps && ps.status !== "offline";
  });

  const pendingCount = pendingIncoming.length;

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  // Get the current list length based on active tab
  const currentListLength =
    tab === "all" ? friends.length
    : tab === "online" ? onlineFriends.length
    : tab === "pending" ? pendingIncoming.length + pendingSent.length
    : 0;

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (currentListLength === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => (i < currentListLength - 1 ? i + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => (i > 0 ? i - 1 : currentListLength - 1));
      }
    },
    [currentListLength],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 flex items-center gap-4 px-4 border-b border-border-subtle flex-shrink-0">
        <h3 className="font-medium text-sm text-text-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          {t("title")}
        </h3>
        <FriendsTabs active={tab} onChange={handleTabChange} pendingCount={pendingCount} />
      </div>

      <ScrollArea className="flex-1">
        {tab === "add" && <AddFriendBar />}

        {tab === "all" && (
          <div
            ref={listRef}
            role="listbox"
            tabIndex={0}
            aria-label="All friends"
            onKeyDown={handleListKeyDown}
            className="p-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
          >
            <p className="px-3 py-1 text-xs font-medium text-text-muted uppercase tracking-wider">
              {t("section.all", { count: friends.length })}
            </p>
            {friends.map((f, idx) => (
              <div
                key={f.id}
                role="option"
                aria-selected={idx === focusedIndex}
                className={idx === focusedIndex ? "ring-2 ring-primary/50 rounded-lg" : ""}
              >
                <FriendItem friendship={f} currentUserId={currentUserId} />
              </div>
            ))}
            {friends.length === 0 && (
              <p className="px-3 py-8 text-sm text-text-muted text-center">
                {t("empty.all")}
              </p>
            )}
          </div>
        )}

        {tab === "online" && (
          <div
            ref={listRef}
            role="listbox"
            tabIndex={0}
            aria-label="Online friends"
            onKeyDown={handleListKeyDown}
            className="p-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
          >
            <p className="px-3 py-1 text-xs font-medium text-text-muted uppercase tracking-wider">
              {t("section.online", { count: onlineFriends.length })}
            </p>
            {onlineFriends.map((f, idx) => (
              <div
                key={f.id}
                role="option"
                aria-selected={idx === focusedIndex}
                className={idx === focusedIndex ? "ring-2 ring-primary/50 rounded-lg" : ""}
              >
                <FriendItem friendship={f} currentUserId={currentUserId} />
              </div>
            ))}
            {onlineFriends.length === 0 && (
              <p className="px-3 py-8 text-sm text-text-muted text-center">
                {t("empty.online")}
              </p>
            )}
          </div>
        )}

        {tab === "pending" && (
          <div
            ref={listRef}
            role="listbox"
            tabIndex={0}
            aria-label="Pending friend requests"
            onKeyDown={handleListKeyDown}
            className="p-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
          >
            {pendingIncoming.length > 0 && (
              <>
                <p className="px-3 py-1 text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t("section.incoming", { count: pendingIncoming.length })}
                </p>
                {pendingIncoming.map((f, idx) => (
                  <div
                    key={f.id}
                    role="option"
                    aria-selected={idx === focusedIndex}
                    className={idx === focusedIndex ? "ring-2 ring-primary/50 rounded-lg" : ""}
                  >
                    <PendingItem friendship={f} type="incoming"  />
                  </div>
                ))}
              </>
            )}
            {pendingSent.length > 0 && (
              <>
                <p className="px-3 py-1 mt-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t("section.sent", { count: pendingSent.length })}
                </p>
                {pendingSent.map((f, idx) => {
                  const globalIdx = pendingIncoming.length + idx;
                  return (
                    <div
                      key={f.id}
                      role="option"
                      aria-selected={globalIdx === focusedIndex}
                      className={globalIdx === focusedIndex ? "ring-2 ring-primary/50 rounded-lg" : ""}
                    >
                      <PendingItem friendship={f} type="outgoing"  />
                    </div>
                  );
                })}
              </>
            )}
            {pendingIncoming.length === 0 && pendingSent.length === 0 && (
              <p className="px-3 py-8 text-sm text-text-muted text-center">
                {t("empty.pending")}
              </p>
            )}
          </div>
        )}

      </ScrollArea>
    </div>
  );
}
