import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Avatar } from "../ui/Avatar";
import { confirm } from "../ui/ConfirmDialog";
import { api } from "../../lib/api";
import type { PaginatedResponse } from "../../types/models";

interface Ban {
  userId: string;
  username: string;
  avatar: string | null;
  reason?: string;
  bannedAt?: string;
}

interface BanListProps {
  serverId: string;
}

export function BanList({ serverId }: BanListProps) {
  const { t } = useTranslation(["server", "common"]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [unbanning, setUnbanning] = useState<string | null>(null);

  const loadBans = useCallback(
    async (pageCursor?: string) => {
      const isInitial = !pageCursor;
      if (isInitial) setLoading(true);
      else setLoadingMore(true);
      try {
        const result = (await api.servers.getBans(
          serverId,
          pageCursor,
          50,
        )) as PaginatedResponse<Ban>;
        if (isInitial) {
          setBans(result.data);
        } else {
          setBans((prev) => [...prev, ...result.data]);
        }
        setCursor(result.cursor);
      } catch {
        // Ignore
      } finally {
        if (isInitial) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [serverId],
  );

  useEffect(() => {
    loadBans();
  }, [serverId, loadBans]);

  const handleUnban = async (ban: Ban) => {
    if (!(await confirm(t("server:bans.unbanConfirm", { username: ban.username })))) return;
    setUnbanning(ban.userId);
    try {
      await api.servers.unbanMember(serverId, ban.userId);
      setBans((prev) => prev.filter((b) => b.userId !== ban.userId));
    } catch {
      // Ignore
    } finally {
      setUnbanning(null);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return bans;
    const q = search.toLowerCase();
    return bans.filter((b) => b.username.toLowerCase().includes(q));
  }, [bans, search]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <div className="w-9 h-9 rounded-full skeleton" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-28 rounded skeleton" />
              <div className="h-2.5 w-40 rounded skeleton" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      {bans.length > 0 && (
        <div className="mb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("server:bans.searchPlaceholder")}
            prefix={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
            className="text-sm"
          />
        </div>
      )}

      {/* Ban count */}
      {bans.length > 0 && (
        <p className="text-xs text-text-muted mb-2">
          {filtered.length === bans.length
            ? t("server:bans.count", { count: bans.length })
            : t("server:bans.filtered", { filtered: filtered.length, total: bans.length })}
        </p>
      )}

      {/* Ban list */}
      <div className="space-y-1">
        {filtered.map((ban) => (
          <div
            key={ban.userId}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-elevated transition-colors group"
          >
            <Avatar src={ban.avatar} name={ban.username} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-medium text-text-primary truncate">
                  {ban.username}
                </p>
                {ban.bannedAt && (
                  <span className="text-[10px] text-text-muted flex-shrink-0">
                    {formatDate(ban.bannedAt)}
                  </span>
                )}
              </div>
              {ban.reason && (
                <p className="text-xs text-text-muted truncate mt-0.5">
                  {ban.reason}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleUnban(ban)}
              loading={unbanning === ban.userId}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {t("server:bans.unban")}
            </Button>
          </div>
        ))}

        {/* Empty states */}
        {bans.length === 0 && (
          <div className="flex flex-col items-center py-12 text-text-muted">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 15h8M9 9h.01M15 9h.01" />
            </svg>
            <p className="text-sm">{t("server:bans.empty")}</p>
          </div>
        )}
        {bans.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-text-muted py-6 text-center">
            {t("server:bans.noResults", { search })}
          </p>
        )}
      </div>

      {/* Load more */}
      {cursor && (
        <div className="flex justify-center py-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => loadBans(cursor)}
            disabled={loadingMore}
          >
            {loadingMore ? t("common:loading") : t("server:bans.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
