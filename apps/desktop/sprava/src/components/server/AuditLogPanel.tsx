import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "../../lib/api";
import type { AuditLogEntry, PaginatedResponse } from "../../types/models";

interface AuditLogPanelProps {
  serverId: string;
}

const ACTION_TYPES = [
  "MEMBER_KICK",
  "MEMBER_BAN",
  "MEMBER_UNBAN",
  "ROLE_CREATE",
  "ROLE_UPDATE",
  "ROLE_DELETE",
  "ROLE_ASSIGN",
  "ROLE_REMOVE",
  "CHANNEL_CREATE",
  "CHANNEL_UPDATE",
  "CHANNEL_DELETE",
  "SERVER_UPDATE",
  "OWNERSHIP_TRANSFER",
  "INVITE_REGENERATE",
] as const;

// ACTION_LABELS are now provided via i18n keys: audit.action.{ACTION_TYPE}

const ACTION_COLORS: Record<string, string> = {
  MEMBER_KICK: "text-amber-400",
  MEMBER_BAN: "text-red-400",
  MEMBER_UNBAN: "text-emerald-400",
  ROLE_CREATE: "text-violet-400",
  ROLE_UPDATE: "text-violet-400",
  ROLE_DELETE: "text-violet-400",
  ROLE_ASSIGN: "text-violet-400",
  ROLE_REMOVE: "text-violet-400",
  CHANNEL_CREATE: "text-sky-400",
  CHANNEL_UPDATE: "text-sky-400",
  CHANNEL_DELETE: "text-sky-400",
  SERVER_UPDATE: "text-text-muted",
  OWNERSHIP_TRANSFER: "text-amber-400",
  INVITE_REGENERATE: "text-text-muted",
};

function getActionIcon(actionType: string) {
  const cls = ACTION_COLORS[actionType] ?? "text-text-muted";
  switch (actionType) {
    case "MEMBER_KICK":
      return (
        <svg className={cls} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="18" y1="8" x2="23" y2="13" />
          <line x1="23" y1="8" x2="18" y2="13" />
        </svg>
      );
    case "MEMBER_BAN":
      return (
        <svg className={cls} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      );
    case "MEMBER_UNBAN":
      return (
        <svg className={cls} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      );
    case "ROLE_CREATE":
    case "ROLE_UPDATE":
    case "ROLE_DELETE":
    case "ROLE_ASSIGN":
    case "ROLE_REMOVE":
      return (
        <svg className={cls} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "CHANNEL_CREATE":
    case "CHANNEL_UPDATE":
    case "CHANNEL_DELETE":
      return (
        <svg className={cls} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="9" x2="20" y2="9" />
          <line x1="4" y1="15" x2="20" y2="15" />
          <line x1="10" y1="3" x2="8" y2="21" />
          <line x1="16" y1="3" x2="14" y2="21" />
        </svg>
      );
    case "SERVER_UPDATE":
    case "INVITE_REGENERATE":
      return (
        <svg className={cls} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "OWNERSHIP_TRANSFER":
      return (
        <svg className={cls} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      );
    default:
      return (
        <svg className="text-text-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      );
  }
}

function FormatAction({ entry }: { entry: AuditLogEntry }) {
  const { t } = useTranslation("server");
  const meta = entry.metadata as Record<string, string> | null;

  const targetName = (() => {
    if (entry.targetType === "User") {
      return entry.target?.username ?? t("audit.deletedUser");
    }
    if (entry.targetType === "Channel") {
      return meta?.channelName ?? meta?.name ?? "unknown";
    }
    if (entry.targetType === "Role") {
      return meta?.roleName ?? meta?.name ?? "unknown";
    }
    return null;
  })();

  const descKey = `audit.desc.${entry.actionType}`;
  const desc = t(descKey, { defaultValue: entry.actionType.toLowerCase().replace(/_/g, " ") });

  switch (entry.actionType) {
    case "MEMBER_BAN":
      return (
        <>
          {desc} <strong className="font-medium text-text-primary">{targetName}</strong>
          {meta?.reason && <span className="text-text-muted"> — {meta.reason}</span>}
        </>
      );
    case "SERVER_UPDATE":
    case "INVITE_REGENERATE":
      return <>{desc}</>;
    case "CHANNEL_CREATE":
    case "CHANNEL_UPDATE":
    case "CHANNEL_DELETE":
      return <>{desc} <strong className="font-medium text-text-primary">#{targetName}</strong></>;
    default:
      return <>{desc} <strong className="font-medium text-text-primary">{targetName}</strong></>;
  }
}

function useFormatTimestamp() {
  const { t } = useTranslation("server");
  return (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return t("audit.time.justNow");
    if (diffMin < 60) return t("audit.time.minutesAgo", { count: diffMin });
    if (diffHr < 24) return t("audit.time.hoursAgo", { count: diffHr });
    if (diffDay < 7) return t("audit.time.daysAgo", { count: diffDay });
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };
}

function UserAvatar({ username, avatar, size = 32 }: { username: string; avatar: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  return avatar && !failed ? (
    <img
      src={avatar}
      alt={username}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className="rounded-full bg-elevated-2 flex items-center justify-center font-display font-bold text-text-secondary flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {username.slice(0, 2).toUpperCase()}
    </div>
  );
}

const ROW_HEIGHT = 50;

export function AuditLogPanel({ serverId }: AuditLogPanelProps) {
  const { t } = useTranslation("server");
  const formatTimestamp = useFormatTimestamp();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchEntries = useCallback(
    async (cursorValue?: string, reset = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (reset) {
        setInitialLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const result = (await api.servers.getAuditLog(
          serverId,
          cursorValue,
          50,
          filter || undefined,
        )) as PaginatedResponse<AuditLogEntry>;
        if (reset) {
          setEntries(result.data);
        } else {
          setEntries((prev) => [...prev, ...result.data]);
        }
        setCursor(result.cursor);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        setLoading(false);
        setInitialLoading(false);
        loadingRef.current = false;
      }
    },
    [serverId, filter],
  );

  useEffect(() => {
    fetchEntries(undefined, true);
  }, [fetchEntries]);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Infinite scroll: load more when near bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !cursor || loadingRef.current) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 200) {
      fetchEntries(cursor);
    }
  }, [cursor, fetchEntries]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter */}
      <div className="flex items-center gap-3 pb-4 flex-shrink-0">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-elevated border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">{t("audit.allActions")}</option>
          {ACTION_TYPES.map((actionType) => (
            <option key={actionType} value={actionType}>
              {t(`audit.action.${actionType}`)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 mb-4 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted/40">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p className="text-sm text-text-muted">{t("audit.empty")}</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto min-h-0"
        >
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = entries[virtualRow.index];
              return (
                <div
                  key={entry.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-elevated/60 transition-colors duration-100">
                    <UserAvatar username={entry.user.username} avatar={entry.user.avatar} size={34} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] leading-snug text-text-secondary">
                        <span className="font-semibold text-text-primary">{entry.user.username}</span>
                        {" "}
                        <FormatAction entry={entry} />
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium opacity-80">
                        {getActionIcon(entry.actionType)}
                      </span>
                      <span className="text-[11px] text-text-muted tabular-nums w-16 text-right">
                        {formatTimestamp(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Loading indicator at bottom */}
          {loading && (
            <div className="flex justify-center py-3">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
