import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { useAppStore } from "../../store/app.store";
import { usePermission, useHasAnyPermission } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";
import { api } from "../../lib/api";
import { InviteModal } from "./InviteModal";
import { CreateChannelModal } from "./CreateChannelModal";
import { ServerSettingsModal } from "./ServerSettingsModal";
import { confirm } from "../ui/ConfirmDialog";
import { Icons } from "../ui/icons";
import type { Server } from "../../types/models";

interface ServerHeaderProps {
  server: Server;
}

export function ServerHeader({ server }: ServerHeaderProps) {
  const { t } = useTranslation("server");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownClosing, setDropdownClosing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"overview" | "invites" | "roles" | "bans" | "audit-log">("overview");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isOwner = server.ownerId === currentUserId;
  const canInvite = usePermission(server.id, P.GENERATE_INVITE);
  const canConfigureChannels = usePermission(server.id, P.CONFIGURE_CHANNELS);
  const canOpenSettings = useHasAnyPermission(server.id, P.CONFIGURE_SERVER, P.CONFIGURE_CHANNELS, P.CONFIGURE_ROLES, P.BAN);

  const closeDropdown = useCallback(() => {
    if (!dropdownOpen || dropdownClosing) return;
    setDropdownClosing(true);
  }, [dropdownOpen, dropdownClosing]);

  // After close animation, unmount
  useEffect(() => {
    if (!dropdownClosing) return;
    const el = menuRef.current;
    if (!el) { setDropdownOpen(false); setDropdownClosing(false); return; }
    const handler = () => { setDropdownOpen(false); setDropdownClosing(false); };
    el.addEventListener("animationend", handler, { once: true });
    return () => el.removeEventListener("animationend", handler);
  }, [dropdownClosing]);

  // Outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen, closeDropdown]);

  const toggleDropdown = () => {
    if (dropdownOpen) {
      closeDropdown();
    } else {
      setDropdownOpen(true);
      setDropdownClosing(false);
    }
  };

  const handleItemClick = (action: () => void) => {
    action();
    setDropdownOpen(false);
    setDropdownClosing(false);
  };

  const handleLeave = async () => {
    if (!(await confirm(t("header.leaveConfirm", { name: server.name })))) return;
    try {
      await api.servers.leave(server.id);
      useAppStore.getState().removeServer(server.id);
      useUIStore.getState().navigateToFriends();
    } catch {
      // Ignore
    }
  };

  // Build items list for stagger index
  const items: { label: string; icon?: React.ReactNode; danger?: boolean; onClick: () => void; separator?: boolean }[] = [
    ...(canInvite ? [{ label: t("header.invitePeople"), icon: Icons.userPlus, onClick: () => handleItemClick(() => setInviteOpen(true)) }] : []),
    ...(canOpenSettings ? [{ label: t("header.serverSettings"), icon: Icons.settings, onClick: () => handleItemClick(() => setSettingsOpen(true)) }] : []),
    ...(canConfigureChannels ? [{ label: t("header.createChannel"), icon: Icons.plus, onClick: () => handleItemClick(() => setCreateChannelOpen(true)) }] : []),
    { separator: true, label: "", onClick: () => {} },
    {
      label: isOwner ? t("header.deleteServer") : t("header.leaveServer"),
      icon: isOwner ? Icons.trash : Icons.logOut,
      danger: true,
      onClick: () => handleItemClick(() => { isOwner ? setSettingsOpen(true) : handleLeave(); }),
    },
  ];

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={toggleDropdown}
          className="h-12 w-full flex items-center justify-between px-4 border-b border-border-subtle flex-shrink-0 hover:bg-elevated transition-colors"
        >
          <h2 className="font-display font-bold text-sm truncate">{server.name}</h2>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-text-muted transition-transform duration-200 ${dropdownOpen && !dropdownClosing ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {dropdownOpen && (
          <div
            ref={menuRef}
            className="absolute top-full left-2 right-2 mt-1 bg-elevated border border-border-subtle rounded-lg shadow-xl py-1 z-20 origin-top"
            style={{
              animation: dropdownClosing
                ? "sp-close 150ms ease-in both"
                : "sp-open 250ms var(--ease-spring) both",
            }}
          >
            {items.map((item, i) =>
              item.separator ? (
                <div key={`sep-${i}`} className="h-px bg-border-subtle mx-2 my-1" />
              ) : (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2 ${
                    item.danger
                      ? "text-danger hover:bg-danger/10"
                      : "text-text-secondary hover:bg-elevated-2 hover:text-text-primary"
                  }`}
                  style={{
                    animation: dropdownClosing
                      ? "none"
                      : `sp-item-in 250ms var(--ease-out) ${40 + i * 35}ms both`,
                  }}
                >
                  {item.icon && <span className="w-4 h-4 flex-shrink-0 opacity-70">{item.icon}</span>}
                  {item.label}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        inviteCode={server.inviteCode}
        serverId={server.id}
        onOpenInviteSettings={() => {
          setInviteOpen(false);
          setSettingsTab("invites");
          setSettingsOpen(true);
        }}
      />
      <CreateChannelModal
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        serverId={server.id}
      />
      <ServerSettingsModal
        open={settingsOpen}
        onClose={() => { setSettingsOpen(false); setSettingsTab("overview"); }}
        server={server}
        initialTab={settingsTab}
      />
    </>
  );
}
