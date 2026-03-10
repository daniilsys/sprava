import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { confirm } from "../ui/ConfirmDialog";

import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { useFriendsStore } from "../../store/friends.store";
import { usePermissionsStore } from "../../store/permissions.store";
import { usePermission, getMemberHighestRolePosition } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";
import { api } from "../../lib/api";
import type { User, UserProfile, Role, DmConversation } from "../../types/models";

// Simple TTL cache for profile data to avoid duplicate requests
const profileCache = new Map<string, { data: UserProfile | null; ts: number }>();
const rolesCache = new Map<string, { data: Role[]; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

// ─── Inline SVG icons ────────────────────────────────────────────────────────

function EnvelopeIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function MapPinIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function LinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CalendarIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2v4" /><path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface UserProfilePopupProps {
  user: User;
  serverId?: string | null;
  anchorRect: DOMRect;
  preferPlacement?: "right" | "below";
  onClose: () => void;
}

export function UserProfilePopup({ user, serverId, anchorRect, preferPlacement = "right", onClose }: UserProfilePopupProps) {
  const { t } = useTranslation("common");
  const popupRef = useRef<HTMLDivElement>(null);
  const presenceState = useAppStore((s) => s.presence.get(user.id));
  const userStatus = presenceState?.status ?? "offline";
  const statusMessage = presenceState?.statusMessage ?? "";
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isSelf = user.id === currentUserId;
  const [actionLoading, setActionLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberRoles, setMemberRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);

  // Friendship status
  const friendStatus = useFriendsStore((s) => {
    if (s.friends.some((f) => f.sender.id === user.id || f.receiver.id === user.id)) return "friend";
    if (s.pendingSent.some((f) => f.receiver.id === user.id)) return "pending_sent";
    if (s.pendingIncoming.some((f) => f.sender.id === user.id)) return "pending_incoming";
    if (s.blocked.some((f) => f.sender.id === user.id || f.receiver.id === user.id)) return "blocked";
    return "none";
  });

  // Get all server roles from store — extract raw map, filter in useMemo to avoid new array ref each render
  const rolesMap = useAppStore((s) => s.roles);
  const allServerRoles = useMemo(() => {
    if (!serverId) return [];
    return Array.from(rolesMap.values()).filter((r) => r.serverId === serverId);
  }, [rolesMap, serverId]);

  // Can current user manage roles? (reactive hook)
  const canManageRolesState = usePermission(serverId ?? undefined, P.CONFIGURE_ROLES);

  // My highest role position
  const myHighestPosition = useMemo(() => {
    if (!serverId || !currentUserId) return Infinity;
    const server = useAppStore.getState().servers.get(serverId);
    if (server?.ownerId === currentUserId) return -1;
    const myRoleIds = usePermissionsStore.getState().myRoleIds.get(serverId);
    if (!myRoleIds) return Infinity;
    let highest = Infinity;
    for (const roleId of myRoleIds) {
      const role = useAppStore.getState().roles.get(roleId);
      if (role && role.position < highest) highest = role.position;
    }
    return highest;
  }, [serverId, currentUserId]);

  // Close on outside click (delayed by a frame so the opening click doesn't immediately close it)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handler);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Fetch profile + roles (with client-side cache)
  useEffect(() => {
    let cancelled = false;
    const now = Date.now();

    const cachedProfile = profileCache.get(user.username);
    const cachedRoles = serverId ? rolesCache.get(`${serverId}:${user.id}`) : null;

    const profileFresh = cachedProfile && now - cachedProfile.ts < CACHE_TTL;
    const rolesFresh = !serverId || (cachedRoles && now - cachedRoles.ts < CACHE_TTL);

    if (profileFresh && rolesFresh) {
      setProfile(cachedProfile!.data);
      setMemberRoles(cachedRoles?.data ?? []);
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [profileResult, memberRolesResult] = await Promise.all([
          profileFresh
            ? cachedProfile!.data
            : api.users.getByUsername(user.username).catch(() => null),
          rolesFresh
            ? (cachedRoles?.data ?? [])
            : serverId
              ? api.roles.getMemberRoles(serverId, user.id).catch(() => [])
              : Promise.resolve([]),
        ]);
        if (cancelled) return;

        const profileData = profileResult as UserProfile | null;
        const rolesData = memberRolesResult as Role[];

        profileCache.set(user.username, { data: profileData, ts: Date.now() });
        if (serverId) {
          rolesCache.set(`${serverId}:${user.id}`, { data: rolesData, ts: Date.now() });
        }

        setProfile(profileData);
        setMemberRoles(rolesData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [user.username, user.id, serverId]);

  const handleMessage = async () => {
    setActionLoading(true);
    try {
      const dm = (await api.dm.create({ participantIds: [currentUserId!, user.id] })) as DmConversation;
      useAppStore.getState().addDm(dm);
      useUIStore.getState().navigateToDm(dm.id);
      onClose();
    } catch {
      const dms = useAppStore.getState().dms;
      for (const [id, dm] of dms) {
        if (dm.participants?.some((p) => p.userId === user.id)) {
          useUIStore.getState().navigateToDm(id);
          onClose();
          return;
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleFriendAction = async () => {
    if (friendStatus === "friend") {
      if (!(await confirm(t("profile.removeConfirm", { username: user.username })))) return;
    } else if (friendStatus === "pending_sent") {
      if (!(await confirm(t("profile.cancelConfirm", { username: user.username })))) return;
    }
    setActionLoading(true);
    try {
      if (friendStatus === "none") {
        await useFriendsStore.getState().sendRequest(user.username);
      } else if (friendStatus === "pending_incoming") {
        await useFriendsStore.getState().acceptRequest(user.id);
      } else if (friendStatus === "pending_sent") {
        await useFriendsStore.getState().cancelRequest(user.id);
      } else if (friendStatus === "friend") {
        await useFriendsStore.getState().removeFriend(user.id);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const friendButtonLabel = (() => {
    switch (friendStatus) {
      case "friend": return t("profile.removeFriend");
      case "pending_sent": return t("profile.cancelRequest");
      case "pending_incoming": return t("profile.acceptRequest");
      case "blocked": return t("profile.blocked");
      default: return t("profile.addFriend");
    }
  })();

  const friendButtonVariant = friendStatus === "friend" || friendStatus === "pending_sent"
    ? "secondary" as const
    : "secondary" as const;

  // Roles the current user can assign (lower position = higher rank)
  const assignableRoles = allServerRoles
    .filter((r) => !r.isWorld && r.position > myHighestPosition)
    .sort((a, b) => a.position - b.position);

  const memberRoleIds = new Set(memberRoles.map((r) => r.id));

  // Can't manage roles for users with higher or equal role position (unless owner)
  const targetHighestPos = useMemo(
    () => getMemberHighestRolePosition(memberRoles.map((r) => r.id), rolesMap),
    [memberRoles, rolesMap],
  );
  const targetIsOwner = serverId ? useAppStore.getState().servers.get(serverId)?.ownerId === user.id : false;
  const canManageThisUser = canManageRolesState && !isSelf && !targetIsOwner && (myHighestPosition < targetHighestPos || myHighestPosition === -1);

  const handleToggleRole = async (role: Role) => {
    if (!serverId) return;
    const has = memberRoleIds.has(role.id);
    try {
      if (has) {
        await api.roles.removeFromMember(serverId, role.id, user.id);
        setMemberRoles((prev) => prev.filter((r) => r.id !== role.id));
      } else {
        await api.roles.assignToMember(serverId, role.id, user.id);
        setMemberRoles((prev) => [...prev, role]);
      }
      // Invalidate cache so reopening popup fetches fresh data
      rolesCache.delete(`${serverId}:${user.id}`);
    } catch (e) {
      console.error("Failed to toggle role:", e);
    }
  };

  // Position popup, clamp to viewport
  const popupWidth = 320; // w-80
  const popupHeight = 420;
  let top: number;
  let left: number;

  if (preferPlacement === "below") {
    top = Math.min(anchorRect.bottom + 8, window.innerHeight - popupHeight - 8);
    left = Math.min(Math.max(8, anchorRect.left), window.innerWidth - popupWidth - 8);
  } else {
    top = Math.min(Math.max(8, anchorRect.top), window.innerHeight - popupHeight - 8);
    left = Math.min(anchorRect.right + 8, window.innerWidth - popupWidth - 8);
  }

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;

  // Collect info items for the compact details row
  const hasInfoSection = profile?.profile?.bio || profile?.profile?.location || profile?.profile?.website;

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-50 w-80 bg-surface rounded-2xl shadow-2xl overflow-hidden animate-fade-slide-left"
      style={{
        top,
        left,
        border: "1px solid var(--color-border-subtle)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px var(--color-border-subtle)",
      }}
    >
      {/* Banner with subtle pattern overlay */}
      <div
        className="h-[72px] relative"
        style={{
          background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-[0.08]" style={{
          backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
      </div>

      {/* Avatar overlapping banner */}
      <div className="px-5 -mt-9 relative z-10">
        <div
          className="border-[3.5px] border-surface rounded-full w-fit"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
        >
          <Avatar src={user.avatar} name={user.username} size="lg" status={userStatus} />
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-2 pb-4 max-h-[60vh] overflow-y-auto">
        {/* Identity header */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[15px] text-text-primary leading-tight truncate">{user.username}</p>
            {/* Email next to username */}
            {profile?.email && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <EnvelopeIcon className="text-text-muted flex-shrink-0" />
                <p className="text-xs text-text-muted truncate">{profile.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Status message */}
        {statusMessage && (
          <p className="text-xs text-text-secondary mt-1.5 italic">
            {statusMessage}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : (
          <>
            {/* Info cards — compact icon+text rows inside a rounded card */}
            {(hasInfoSection || memberSince) && (
              <div className="mt-3 bg-elevated/60 rounded-xl border border-border-subtle overflow-hidden">
                {/* Bio */}
                {profile?.profile?.bio && (
                  <div className="px-3.5 py-2.5 border-b border-border-subtle last:border-b-0">
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1">{t("profile.aboutMe")}</p>
                    <p className="text-[13px] text-text-secondary leading-relaxed">{profile.profile.bio}</p>
                  </div>
                )}

                {/* Metadata rows: location, website, member since */}
                {(profile?.profile?.location || profile?.profile?.website || memberSince) && (
                  <div className="divide-y divide-border-subtle">
                    {profile?.profile?.location && (
                      <div className="flex items-center gap-2.5 px-3.5 py-2">
                        <MapPinIcon className="text-text-muted flex-shrink-0" />
                        <span className="text-[13px] text-text-secondary truncate">{profile.profile.location}</span>
                      </div>
                    )}
                    {profile?.profile?.website && (
                      <div className="flex items-center gap-2.5 px-3.5 py-2">
                        <LinkIcon className="text-text-muted flex-shrink-0" />
                        <a
                          href={profile.profile.website.startsWith("http") ? profile.profile.website : `https://${profile.profile.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] text-primary hover:text-primary-hover hover:underline truncate transition-colors"
                        >
                          {profile.profile.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}
                    {memberSince && (
                      <div className="flex items-center gap-2.5 px-3.5 py-2">
                        <CalendarIcon className="text-text-muted flex-shrink-0" />
                        <span className="text-[13px] text-text-secondary">{memberSince}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Roles */}
            {serverId && (memberRoles.length > 0 || canManageThisUser) && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">{t("profile.roles")}</p>
                  {canManageThisUser && (
                    <button
                      onClick={() => setRoleEditorOpen((v) => !v)}
                      className="text-[11px] font-medium text-primary hover:text-primary-hover transition-colors"
                    >
                      {roleEditorOpen ? t("profile.done") : t("profile.edit")}
                    </button>
                  )}
                </div>

                {/* Role badges (exclude @world — it applies to everyone implicitly) */}
                {memberRoles.filter((r) => !r.isWorld).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {memberRoles.filter((r) => !r.isWorld).map((role) => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md"
                        style={{
                          backgroundColor: role.color ? `${role.color}18` : "var(--color-elevated-2)",
                          color: role.color || "var(--color-text-secondary)",
                          border: `1px solid ${role.color ? `${role.color}30` : "var(--color-border-subtle)"}`,
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: role.color || "var(--color-text-muted)" }}
                        />
                        {role.name}
                      </span>
                    ))}
                  </div>
                )}
                {memberRoles.filter((r) => !r.isWorld).length === 0 && !roleEditorOpen && (
                  <p className="text-xs text-text-muted">{t("profile.noRoles")}</p>
                )}

                {/* Role editor */}
                {roleEditorOpen && assignableRoles.length > 0 && (
                  <div className="mt-2 border border-border-subtle rounded-xl bg-elevated p-1 max-h-36 overflow-y-auto">
                    {assignableRoles.map((role) => {
                      const checked = memberRoleIds.has(role.id);
                      return (
                        <label
                          key={role.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-elevated-2 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleRole(role)}
                            className="accent-primary w-3.5 h-3.5"
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: role.color || "var(--color-text-muted)" }}
                          />
                          <span className="text-xs text-text-primary truncate">{role.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {!isSelf && (
              <div className="flex gap-2 mt-4">
                <Button size="sm" className="flex-1" onClick={handleMessage} loading={actionLoading}>
                  {t("profile.message")}
                </Button>
                {friendStatus !== "blocked" && (
                  <Button
                    size="sm"
                    variant={friendButtonVariant}
                    className="flex-1"
                    onClick={handleFriendAction}
                    loading={actionLoading}
                  >
                    {friendButtonLabel}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
