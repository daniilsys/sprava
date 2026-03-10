import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Avatar } from "./Avatar";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import type { Channel, DmConversation, Server } from "../../types/models";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type ResultItem =
  | { type: "server"; server: Server }
  | { type: "channel"; channel: Channel; serverName: string }
  | { type: "dm"; dm: DmConversation; displayName: string; avatar: string | null };

function getDmDisplayName(dm: DmConversation, currentUserId: string): string {
  if (dm.name) return dm.name;
  const other = dm.participants?.find((p) => p.userId !== currentUserId);
  return other?.user?.username ?? "Unknown";
}

function getDmAvatar(dm: DmConversation, currentUserId: string): string | null {
  if (dm.type === "GROUP") return dm.icon;
  const other = dm.participants?.find((p) => p.userId !== currentUserId);
  return other?.user?.avatar ?? null;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentUserId = useAuthStore((s) => s.user?.id ?? "");
  const servers = useAppStore((s) => s.servers);
  const channels = useAppStore((s) => s.channels);
  const dms = useAppStore((s) => s.dms);

  // Build search index
  const allItems = useMemo((): ResultItem[] => {
    const items: ResultItem[] = [];

    for (const server of servers.values()) {
      items.push({ type: "server", server });
    }

    for (const channel of channels.values()) {
      if (channel.type === "PARENT") continue;
      const server = servers.get(channel.serverId);
      items.push({ type: "channel", channel, serverName: server?.name ?? "" });
    }

    for (const dm of dms.values()) {
      items.push({
        type: "dm",
        dm,
        displayName: getDmDisplayName(dm, currentUserId),
        avatar: getDmAvatar(dm, currentUserId),
      });
    }

    return items;
  }, [servers, channels, dms, currentUserId]);

  // Filter by query
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allItems.slice(0, 20);
    return allItems
      .filter((item) => {
        switch (item.type) {
          case "server":
            return item.server.name.toLowerCase().includes(q);
          case "channel":
            return (
              item.channel.name.toLowerCase().includes(q) ||
              item.serverName.toLowerCase().includes(q)
            );
          case "dm":
            return item.displayName.toLowerCase().includes(q);
        }
      })
      .slice(0, 20);
  }, [query, allItems]);

  // Reset selection on results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const navigate = useCallback(
    (item: ResultItem) => {
      const ui = useUIStore.getState();
      switch (item.type) {
        case "server":
          ui.navigateToServer(item.server.id);
          break;
        case "channel":
          ui.navigateToChannel(item.channel.serverId, item.channel.id);
          break;
        case "dm":
          ui.navigateToDm(item.dm.id);
          break;
      }
      onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results[selectedIndex]) navigate(results[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [results, selectedIndex, navigate, onClose],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm animate-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg bg-surface border border-border-subtle rounded-xl shadow-2xl overflow-hidden animate-command-palette-in"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted flex-shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("commandPalette.placeholder")}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <kbd className="text-[10px] text-text-muted bg-elevated px-1.5 py-0.5 rounded border border-border-subtle font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && (
            <p className="px-4 py-6 text-sm text-text-muted text-center">{t("noResults")}</p>
          )}
          {results.map((item, i) => (
            <ResultRow
              key={getKey(item)}
              item={item}
              selected={i === selectedIndex}
              onClick={() => navigate(item)}
              onMouseEnter={() => setSelectedIndex(i)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function getKey(item: ResultItem): string {
  switch (item.type) {
    case "server": return `s-${item.server.id}`;
    case "channel": return `c-${item.channel.id}`;
    case "dm": return `d-${item.dm.id}`;
  }
}

function ResultRow({
  item,
  selected,
  onClick,
  onMouseEnter,
}: {
  item: ResultItem;
  selected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  const { t } = useTranslation("common");
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
        selected ? "bg-elevated-2 text-text-primary" : "text-text-secondary hover:bg-elevated"
      }`}
    >
      {item.type === "server" && (
        <>
          <div className="w-8 h-8 rounded-lg bg-elevated-2 flex items-center justify-center overflow-hidden flex-shrink-0">
            {item.server.icon ? (
              <img src={item.server.icon} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
            ) : null}
            <span className={`text-xs font-medium text-text-muted ${item.server.icon ? "hidden" : ""}`}>
              {item.server.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.server.name}</p>
            <p className="text-[11px] text-text-muted">{t("common:server")}</p>
          </div>
        </>
      )}

      {item.type === "channel" && (
        <>
          <div className="w-8 h-8 rounded-lg bg-elevated-2 flex items-center justify-center flex-shrink-0">
            <ChannelTypeIcon type={item.channel.type} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.channel.name}</p>
            <p className="text-[11px] text-text-muted truncate">{item.serverName}</p>
          </div>
        </>
      )}

      {item.type === "dm" && (
        <>
          <Avatar src={item.avatar} name={item.displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.displayName}</p>
            <p className="text-[11px] text-text-muted">
              {item.dm.type === "GROUP" ? t("common:groupDm") : t("common:directMessage")}
            </p>
          </div>
        </>
      )}
    </button>
  );
}

function ChannelTypeIcon({ type }: { type: string }) {
  if (type === "VOICE") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}
