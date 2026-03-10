import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/auth.store";
import { useAppStore } from "../../store/app.store";
import { useUIStore } from "../../store/ui.store";
import { Avatar } from "../ui/Avatar";
import { IconButton } from "../ui/IconButton";
import { StatusPicker } from "./StatusPicker";

export function CurrentUserBar() {
  const { t } = useTranslation("common");
  const user = useAuthStore((s) => s.user);
  const presenceState = useAppStore((s) => (user ? s.presence.get(user.id) : undefined));
  const status = presenceState?.status ?? "online";
  const statusMessage = presenceState?.statusMessage ?? "";

  const [pickerOpen, setPickerOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  if (!user) return null;

  return (
    <div
      ref={barRef}
      className="h-14 flex items-center gap-2 px-3 border-t border-border-subtle bg-surface flex-shrink-0"
    >
      <button
        onClick={() => setPickerOpen(!pickerOpen)}
        className="flex items-center gap-2 flex-1 min-w-0 rounded-lg hover:bg-elevated px-1 py-1 -mx-1 transition-colors"
      >
        <Avatar src={user.avatar} name={user.username} size="sm" status={status} />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-text-primary truncate">{user.username}</p>
          {statusMessage ? (
            <p className="text-[11px] text-text-muted truncate leading-tight">{statusMessage}</p>
          ) : (
            <p className="text-[11px] text-text-muted truncate leading-tight capitalize">{status === "dnd" ? t("status.dnd") : status}</p>
          )}
        </div>
      </button>
      <IconButton
        size="sm"
        onClick={() => useUIStore.getState().openModal("settings")}
        title={t("settings")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </IconButton>

      {pickerOpen && barRef.current && (
        <StatusPicker
          currentStatus={status}
          currentMessage={statusMessage}
          anchorRect={barRef.current.getBoundingClientRect()}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
