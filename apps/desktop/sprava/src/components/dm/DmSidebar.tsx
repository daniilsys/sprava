import { useMemo, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/app.store";
import { useUIStore } from "../../store/ui.store";
import { DmItem } from "./DmItem";
import { NewDmButton } from "./NewDmButton";
import { ScrollArea } from "../ui/ScrollArea";
import { CurrentUserBar } from "../user/CurrentUserBar";
import { OnlineFriendsWidget } from "../friends/OnlineFriendsWidget";

export function DmSidebar() {
  const { t } = useTranslation("dm");
  const dms = useAppStore((s) => s.dms);

  const sortedDms = useMemo(
    () =>
      Array.from(dms.values()).sort((a, b) => {
        // Sort by lastMessageId descending (snowflake IDs are chronological)
        if (a.lastMessageId && b.lastMessageId) {
          return a.lastMessageId > b.lastMessageId ? -1 : 1;
        }
        if (a.lastMessageId) return -1;
        if (b.lastMessageId) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [dms],
  );

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (sortedDms.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => (i < sortedDms.length - 1 ? i + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => (i > 0 ? i - 1 : sortedDms.length - 1));
      } else if (e.key === "Enter" && focusedIndex >= 0 && focusedIndex < sortedDms.length) {
        e.preventDefault();
        useUIStore.getState().navigateToDm(sortedDms[focusedIndex].id);
      }
    },
    [sortedDms, focusedIndex],
  );

  return (
    <div className="w-60 bg-surface border-r border-border-subtle flex flex-col flex-shrink-0">
      <div className="h-12 flex items-center justify-between px-4 border-b border-border-subtle flex-shrink-0">
        <h2 className="font-display font-bold text-sm">{t("sidebar.title")}</h2>
        <NewDmButton />
      </div>
      <button
        onClick={() => useUIStore.getState().openCommandPalette()}
        className="mx-2 mt-2 mb-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-elevated hover:bg-elevated-2 transition-colors text-left group flex-shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted flex-shrink-0">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors">{t("sidebar.search")}</span>
        <kbd className="ml-auto text-[10px] text-text-muted bg-surface px-1 py-0.5 rounded border border-border-subtle font-mono">{navigator.platform.includes("Mac") ? "⌘K" : "Ctrl+K"}</kbd>
      </button>
      <ScrollArea className="flex-1 px-2 py-2">
        <div
          ref={listRef}
          role="listbox"
          tabIndex={0}
          aria-label="Direct messages"
          onKeyDown={handleListKeyDown}
          className="flex flex-col gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
        >
          {sortedDms.map((dm, idx) => (
            <div
              key={dm.id}
              role="option"
              aria-selected={useUIStore.getState().activeDmId === dm.id}
              className={idx === focusedIndex ? "ring-2 ring-primary/50 rounded-lg" : ""}
            >
              <DmItem dm={dm} />
            </div>
          ))}
          {sortedDms.length === 0 && (
            <p className="px-2 py-4 text-xs text-text-muted text-center">
              {t("sidebar.empty")}
            </p>
          )}
        </div>
      </ScrollArea>
      <OnlineFriendsWidget />
      <CurrentUserBar />
    </div>
  );
}
