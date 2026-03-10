import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ServerOverview } from "./ServerOverview";
import { RoleEditor } from "./RoleEditor";
import { InviteSettings } from "./InviteSettings";
import { BanList } from "./BanList";
import { AuditLogPanel } from "./AuditLogPanel";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { usePermission } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";
import { confirm } from "../ui/ConfirmDialog";
import type { Server } from "../../types/models";

interface ServerSettingsModalProps {
  open: boolean;
  onClose: () => void;
  server: Server;
  initialTab?: SettingsTab;
}

type SettingsTab = "overview" | "invites" | "roles" | "bans" | "audit-log";

const allTabs: { id: SettingsTab; labelKey: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    labelKey: "settings.tabs.profile",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
  },
  {
    id: "invites",
    labelKey: "settings.tabs.invites",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    id: "roles",
    labelKey: "settings.tabs.roles",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "bans",
    labelKey: "settings.tabs.bans",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
  },
  {
    id: "audit-log",
    labelKey: "settings.tabs.auditLog",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

export function ServerSettingsModal({ open, onClose, server, initialTab = "overview" }: ServerSettingsModalProps) {
  const { t } = useTranslation("server");
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [deleting, setDeleting] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const isOwner = server.ownerId === currentUserId;
  const canConfigureServer = usePermission(server.id, P.CONFIGURE_SERVER);
  const canConfigureRoles = usePermission(server.id, P.CONFIGURE_ROLES);
  const canGenerateInvite = usePermission(server.id, P.GENERATE_INVITE);
  const canBan = usePermission(server.id, P.BAN);

  const tabs = useMemo(() => {
    const allowed = new Set<SettingsTab>();
    if (isOwner || canConfigureServer) { allowed.add("overview"); allowed.add("audit-log"); }
    if (canGenerateInvite) allowed.add("invites");
    if (canConfigureRoles) allowed.add("roles");
    if (canBan) allowed.add("bans");
    return allTabs.filter((t) => allowed.has(t.id));
  }, [isOwner, canConfigureServer, canConfigureRoles, canGenerateInvite, canBan]);

  useEffect(() => {
    if (open) {
      // If initialTab is not visible, default to first available
      const visibleIds = tabs.map((t) => t.id);
      setTab(visibleIds.includes(initialTab) ? initialTab : visibleIds[0] ?? "overview");
    }
  }, [open, initialTab, tabs]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
    }
  }, [open, visible]);

  useEffect(() => {
    if (!closing) return;
    const el = overlayRef.current;
    if (!el) { setVisible(false); setClosing(false); return; }
    const handler = () => { setVisible(false); setClosing(false); };
    el.addEventListener("animationend", handler, { once: true });
    return () => el.removeEventListener("animationend", handler);
  }, [closing]);

  useEffect(() => {
    if (!visible || closing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, closing, onClose]);

  if (!visible) return null;

  const handleDelete = async () => {
    if (!(await confirm(t("settings.deleteConfirm", { name: server.name })))) return;
    setDeleting(true);
    try {
      await api.servers.delete(server.id);
      useAppStore.getState().removeServer(server.id);
      useUIStore.getState().navigateToFriends();
      onClose();
    } catch (e) {
      console.error("Failed to delete server:", e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-[2px]"
      style={{
        animation: closing
          ? "modal-overlay-out 180ms ease-in both"
          : "modal-overlay-in 200ms ease-out both",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="m-auto bg-surface border border-border-subtle rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex overflow-hidden"
        style={{
          animation: closing
            ? "modal-content-out 180ms ease-in both"
            : "modal-content-in 300ms var(--ease-spring) both",
        }}
      >
        {/* Sidebar */}
        <div className="w-56 bg-elevated border-r border-border-subtle flex flex-col flex-shrink-0">
          <div className="p-4 pb-3">
            <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-widest px-2">
              {t("settings.title")}
            </h2>
          </div>

          <div className="flex-1 px-2 space-y-0.5">
            {tabs.map((tabDef) => (
              <button
                key={tabDef.id}
                onClick={() => setTab(tabDef.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 flex items-center gap-2.5 ${
                  tab === tabDef.id
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-elevated-2 hover:text-text-primary"
                }`}
              >
                <span className={tab === tabDef.id ? "text-primary" : "text-text-muted"}>{tabDef.icon}</span>
                {t(tabDef.labelKey)}
              </button>
            ))}
          </div>

          {isOwner && (
            <div className="p-3 border-t border-border-subtle">
              <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting} className="w-full">
                {t("settings.deleteServer")}
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex justify-between items-center px-8 py-5 border-b border-border-subtle flex-shrink-0">
            <h3 className="text-lg font-display font-bold tracking-tight">
              {t(allTabs.find((tabDef) => tabDef.id === tab)?.labelKey ?? "")}
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-elevated-2 transition-all duration-150"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 min-h-0">
            {tab === "overview" && <div className="h-full overflow-y-auto px-8 py-6"><ServerOverview server={server} /></div>}
            {tab === "invites" && <div className="h-full overflow-y-auto px-8 py-6"><InviteSettings server={server} /></div>}
            {tab === "roles" && <div className="h-full px-8 py-6"><RoleEditor serverId={server.id} /></div>}
            {tab === "bans" && <div className="h-full overflow-y-auto px-8 py-6"><BanList serverId={server.id} /></div>}
            {tab === "audit-log" && <div className="h-full px-8 py-6"><AuditLogPanel serverId={server.id} /></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
