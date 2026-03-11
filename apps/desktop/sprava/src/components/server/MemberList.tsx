import { useEffect, useRef, useState, useCallback, useMemo, type KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { usePermission, useMyHighestRolePosition, getMemberHighestRolePosition } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";
import { MemberItem } from "./MemberItem";
import { ReasonModal } from "../ui/ReasonModal";
import { api } from "../../lib/api";
import { getRoleColor } from "../../utils/roles";
import type { Member, Role, PaginatedResponse } from "../../types/models";

interface MemberListProps {
  serverId: string;
}

export function MemberList({ serverId }: MemberListProps) {
  const { t } = useTranslation(["server", "common"]);
  const memberMap = useAppStore((s) => s.members.get(serverId));
  const server = useAppStore((s) => s.servers.get(serverId));
  const currentUserId = useAuthStore((s) => s.user?.id);

  // Only re-render when a member of THIS server changes presence status
  const memberIds = useMemo(() => memberMap ? Array.from(memberMap.keys()) : [], [memberMap]);
  const presenceSelector = useCallback((s: { presence: Map<string, { status?: string }> }) => {
    const result: Record<string, string> = {};
    for (const id of memberIds) {
      result[id] = s.presence.get(id)?.status ?? "offline";
    }
    return result;
  }, [memberIds]);
  const presenceStatuses = useAppStore(useShallow(presenceSelector));
  const isOwner = server?.ownerId === currentUserId;
  const hasKickPerm = usePermission(serverId, P.KICK);
  const hasBanPerm = usePermission(serverId, P.BAN);
  const myHighestPos = useMyHighestRolePosition(serverId);

  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inflightRef = useRef<string | null>(null);

  const fetchMembers = useCallback(
    async (pageCursor?: string) => {
      if (loading) return;
      setLoading(true);
      try {
        const result = (await api.servers.getMembers(
          serverId,
          pageCursor,
          50,
        )) as PaginatedResponse<Member>;
        useAppStore.getState().appendMembers(serverId, result.data);
        setCursor(result.cursor);
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    },
    [serverId, loading],
  );

  useEffect(() => {
    // Guard: skip if a fetch for this server is already in-flight (StrictMode double-mount)
    if (inflightRef.current === serverId) return;
    inflightRef.current = serverId;
    setCursor(null);
    setLoading(true);
    api.servers.getMembers(serverId, undefined, 50)
      .then((raw) => {
        const result = raw as PaginatedResponse<Member>;
        useAppStore.getState().appendMembers(serverId, result.data);
        setCursor(result.cursor);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, [serverId]);

  const rolesMap = useAppStore((s) => s.roles);

  const members = memberMap ? Array.from(memberMap.values()) : [];

  // Build flat list with section headers, grouped by highest separate role
  type ListItem =
    | { type: "header"; label: string; count: number; color?: string | null }
    | { type: "member"; member: Member };

  const items: ListItem[] = useMemo(() => {
    // Collect separate roles for this server, sorted by position (lowest = highest rank)
    const separateRoles: Role[] = [];
    for (const role of rolesMap.values()) {
      if (role.serverId === serverId && role.separate && !role.isWorld) {
        separateRoles.push(role);
      }
    }
    separateRoles.sort((a, b) => a.position - b.position);

    // For each member, find their highest separate role
    const roleGroups = new Map<string, Member[]>(); // roleId -> members
    const ungroupedOnline: Member[] = [];
    const ungroupedOffline: Member[] = [];

    for (const m of members) {
      const isOnline = presenceStatuses[m.userId] !== "offline";

      // Find highest (lowest position) separate role this member has
      let bestRole: Role | null = null;
      if (m.roleIds) {
        for (const sr of separateRoles) {
          if (m.roleIds.includes(sr.id)) {
            bestRole = sr;
            break; // already sorted by position, first match = highest
          }
        }
      }

      if (bestRole && isOnline) {
        const group = roleGroups.get(bestRole.id) ?? [];
        group.push(m);
        roleGroups.set(bestRole.id, group);
      } else if (isOnline) {
        ungroupedOnline.push(m);
      } else {
        ungroupedOffline.push(m);
      }
    }

    const result: ListItem[] = [];

    // Separate role groups (in position order)
    for (const role of separateRoles) {
      const group = roleGroups.get(role.id);
      if (group && group.length > 0) {
        result.push({ type: "header", label: role.name, count: group.length, color: role.color });
        for (const m of group) result.push({ type: "member", member: m });
      }
    }

    // Online (ungrouped)
    if (ungroupedOnline.length > 0) {
      result.push({ type: "header", label: t("server:members.online"), count: ungroupedOnline.length });
      for (const m of ungroupedOnline) result.push({ type: "member", member: m });
    }

    // Offline
    if (ungroupedOffline.length > 0) {
      result.push({ type: "header", label: t("server:members.offline"), count: ungroupedOffline.length });
      for (const m of ungroupedOffline) result.push({ type: "member", member: m });
    }

    return result;
  }, [members, rolesMap, serverId, presenceStatuses]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (items[index]?.type === "header" ? 28 : 44),
    overscan: 10,
  });

  // Keyboard navigation for member list
  const memberIndices = useMemo(
    () => items.reduce<number[]>((acc, item, i) => {
      if (item.type === "member") acc.push(i);
      return acc;
    }, []),
    [items],
  );
  const [focusedMemberPos, setFocusedMemberPos] = useState(-1);

  const handleListKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (memberIndices.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedMemberPos((i) => (i < memberIndices.length - 1 ? i + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedMemberPos((i) => (i > 0 ? i - 1 : memberIndices.length - 1));
      }
    },
    [memberIndices],
  );

  // Infinite scroll via onScroll — refs to avoid stale closures
  const cursorRef = useRef(cursor);
  const loadingRef = useRef(loading);
  cursorRef.current = cursor;
  loadingRef.current = loading;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingRef.current || !cursorRef.current) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) {
      fetchMembers(cursorRef.current);
    }
  }, [fetchMembers]);

  const [modal, setModal] = useState<{
    type: "kick" | "ban";
    userId: string;
    username: string;
  } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const handleModalConfirm = async (reason: string) => {
    if (!modal) return;
    setModalLoading(true);
    try {
      if (modal.type === "kick") {
        await api.servers.kickMember(serverId, modal.userId);
      } else {
        await api.servers.banMember(serverId, modal.userId, {
          reason: reason || undefined,
        });
      }
      useAppStore.getState().removeMember(serverId, modal.userId);
      setModal(null);
    } catch {
      // Ignore
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="w-60 bg-surface border-l border-border-subtle flex flex-col flex-shrink-0">
      <div className="h-12 flex items-center px-4 border-b border-border-subtle flex-shrink-0">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {t("server:members.title", { count: members.length })}
        </h3>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onKeyDown={handleListKeyDown}
        role="listbox"
        tabIndex={0}
        aria-label="Member list"
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const item = items[vItem.index];
            if (!item) return null;

            if (item.type === "header") {
              return (
                <div
                  key={`header-${item.label}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: vItem.size,
                    transform: `translateY(${vItem.start}px)`,
                  }}
                >
                  <p className="px-2 py-1 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5" style={{ color: item.color || undefined }}>
                    {item.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />}
                    <span className={item.color ? "" : "text-text-muted"}>{item.label} — {item.count}</span>
                  </p>
                </div>
              );
            }

            const m = item.member;
            const username = m.user?.username ?? m.userId.slice(-6);
            const targetHighestPos = getMemberHighestRolePosition(m.roleIds, rolesMap);
            const outranksTarget = myHighestPos < targetHighestPos; // strictly lower position = higher rank
            const canKick = (isOwner || (hasKickPerm && outranksTarget)) && m.userId !== currentUserId && m.userId !== server?.ownerId;
            const canBan = (isOwner || (hasBanPerm && outranksTarget)) && m.userId !== currentUserId && m.userId !== server?.ownerId;

            const roleColor = getRoleColor(m.roleIds, rolesMap);

            const memberPos = memberIndices.indexOf(vItem.index);
            return (
              <div
                key={m.userId}
                role="option"
                aria-selected={memberPos === focusedMemberPos}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: vItem.size,
                  transform: `translateY(${vItem.start}px)`,
                }}
                className={memberPos === focusedMemberPos ? "ring-2 ring-primary/50 rounded-lg" : ""}
              >
                <MemberItem
                  userId={m.userId}
                  username={username}
                  avatar={m.user?.avatar ?? null}
                  serverId={serverId}
                  isOwner={m.userId === server?.ownerId}
                  roleColor={roleColor}
                  onKick={
                    canKick
                      ? () =>
                          setModal({
                            type: "kick",
                            userId: m.userId,
                            username,
                          })
                      : undefined
                  }
                  onBan={
                    canBan
                      ? () =>
                          setModal({
                            type: "ban",
                            userId: m.userId,
                            username,
                          })
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
        {loading && (
          <p className="text-xs text-text-muted text-center py-2">{t("common:loading")}</p>
        )}
      </div>
      <ReasonModal
        open={!!modal}
        onClose={() => setModal(null)}
        onConfirm={handleModalConfirm}
        title={modal?.type === "ban" ? t("server:members.banTitle") : t("server:members.kickTitle")}
        description={
          modal?.type === "ban"
            ? t("server:members.banConfirm", { username: modal.username })
            : t("server:members.kickConfirm", { username: modal?.username })
        }
        loading={modalLoading}
      />
    </div>
  );
}
