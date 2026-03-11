import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store/ui.store";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useUpdater } from "../../hooks/useUpdater";
import { UpdateModal, UpdateIndicator } from "../ui/UpdateBanner";

const isMacOS = navigator.platform.startsWith("Mac");
const appWindow = getCurrentWindow();

function startDrag(e: React.MouseEvent) {
  // Only drag on left click, ignore interactive elements
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest("button, a, input")) return;
  e.preventDefault();
  appWindow.startDragging();
}

export function TitleBar() {
  const { t } = useTranslation("common");
  const activeView = useUIStore((s) => s.activeView);
  const activeChannelId = useUIStore((s) => s.activeChannelId);
  const activeDmId = useUIStore((s) => s.activeDmId);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const channel = useAppStore((s) =>
    activeChannelId ? s.channels.get(activeChannelId) : undefined,
  );
  const dm = useAppStore((s) =>
    activeDmId ? s.dms.get(activeDmId) : undefined,
  );

  // On Windows/Linux: remove native decorations at mount
  useEffect(() => {
    if (!isMacOS) {
      getCurrentWindow().setDecorations(false);
    }
  }, []);

  // Contextual title
  let titleIcon: React.ReactNode = null;
  let titleText = "";

  if (activeView === "friends") {
    titleIcon = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    );
    titleText = t("friends", { defaultValue: "Friends" });
  } else if (activeView === "channel" && channel) {
    titleIcon = <span className="text-text-muted text-xs">#</span>;
    titleText = channel.name;
  } else if (activeView === "dm" && dm) {
    const other = dm.participants?.find((p) => p.userId !== currentUserId);
    titleText = dm.name || other?.user?.username || "DM";
  }

  const { available, version, downloading, progress, error, install } = useUpdater();
  const [modalDismissed, setModalDismissed] = useState(false);
  const showModal = available && !modalDismissed && !downloading && !!version;

  return (
    <>
      <div
        onMouseDown={startDrag}
        className="titlebar h-[36px] flex items-center flex-shrink-0 bg-bg select-none"
      >
        {/* Left: traffic light padding on macOS */}
        {isMacOS && <div className="w-[76px] flex-shrink-0" />}

        {/* Center: contextual title */}
        <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-medium text-text-muted truncate max-w-[300px]">
            {titleIcon}
            {titleText}
          </span>
        </div>

        {/* Right: update icon + window controls (Windows/Linux) */}
        <div className="flex items-center gap-1 pr-1 flex-shrink-0">
          {available && (
            <UpdateIndicator
              version={version}
              downloading={downloading}
              progress={progress}
              error={error}
              onInstall={install}
            />
          )}
          {!isMacOS && <WindowControls />}
          {isMacOS && <div className="w-2" />}
        </div>
      </div>

      {showModal && (
        <UpdateModal
          version={version!}
          onInstall={install}
          onLater={() => setModalDismissed(true)}
        />
      )}
    </>
  );
}

/* ── Windows/Linux window control buttons ── */

function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    appWindow.isMaximized().then(setMaximized);
  }, [appWindow]);

  const handleMaximize = async () => {
    await appWindow.toggleMaximize();
    setMaximized(await appWindow.isMaximized());
  };

  return (
    <div className="flex items-center ml-2">
      {/* Minimize */}
      <button
        onClick={() => appWindow.minimize()}
        className="w-[46px] h-[36px] flex items-center justify-center hover:bg-elevated-2 transition-colors"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" className="text-text-secondary" />
        </svg>
      </button>

      {/* Maximize / Restore */}
      <button
        onClick={handleMaximize}
        className="w-[46px] h-[36px] flex items-center justify-center hover:bg-elevated-2 transition-colors"
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-secondary">
            <rect x="2" y="0" width="8" height="8" rx="0.5" />
            <rect x="0" y="2" width="8" height="8" rx="0.5" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-secondary">
            <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
          </svg>
        )}
      </button>

      {/* Close */}
      <button
        onClick={() => appWindow.close()}
        className="w-[46px] h-[36px] flex items-center justify-center hover:bg-danger transition-colors group"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-text-secondary group-hover:text-white">
          <line x1="1" y1="1" x2="9" y2="9" />
          <line x1="9" y1="1" x2="1" y2="9" />
        </svg>
      </button>
    </div>
  );
}
