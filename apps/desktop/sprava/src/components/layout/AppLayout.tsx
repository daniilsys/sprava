import { useState, useCallback, useEffect } from "react";
import { useSocket } from "../../hooks/useSocket";
import { useUIStore } from "../../store/ui.store";
import { useVoiceStore } from "../../store/voice.store";
import { useAppStore } from "../../store/app.store";
import { ArcSidebar } from "./ArcSidebar";
import { ContentArea } from "./ContentArea";
import { ChannelSidebar } from "../server/ChannelSidebar";
import { DmSidebar } from "../dm/DmSidebar";
import { MemberList } from "../server/MemberList";
import { SettingsModal } from "../settings/SettingsModal";
import { VoiceStatusBar } from "../voice/VoiceStatusBar";
import { DmCallBanner } from "../voice/DmCallBanner";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { CommandPalette } from "../ui/CommandPalette";
import { ConnectionBanner } from "../ui/ConnectionBanner";
import { TitleBar } from "./TitleBar";

export function AppLayout() {
  const [incomingCall, setIncomingCall] = useState<{ dmConversationId: string; callerId: string } | null>(null);

  const onIncomingCall = useCallback((data: { dmConversationId: string; callerId: string }) => {
    setIncomingCall(data);
  }, []);

  const onCallEnded = useCallback((data: { dmConversationId: string }) => {
    setIncomingCall((prev) => prev?.dmConversationId === data.dmConversationId ? null : prev);
  }, []);

  useSocket(onIncomingCall, onCallEnded);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const s = useUIStore.getState();
        if (s.commandPaletteOpen) s.closeCommandPalette();
        else s.openCommandPalette();
        return;
      }
      // Ctrl+Shift+M — toggle mute
      if (e.ctrlKey && e.shiftKey && e.key === "M") {
        e.preventDefault();
        const vs = useVoiceStore.getState();
        if (vs.currentRoomId) vs.toggleMute();
        return;
      }
      // Ctrl+Shift+D — toggle deafen
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        const vs = useVoiceStore.getState();
        if (vs.currentRoomId) vs.toggleDeafen();
        return;
      }
      // Escape — close modals, search, command palette
      if (e.key === "Escape") {
        const us = useUIStore.getState();
        if (us.commandPaletteOpen) { us.closeCommandPalette(); return; }
        if (us.searchPanelOpen) { us.toggleSearchPanel(); return; }
        if (us.modal) { us.closeModal(); return; }
        return;
      }
      // Alt+Up/Down — navigate channels
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const us = useUIStore.getState();
        if (!us.activeServerId) return;
        const channels = Array.from(useAppStore.getState().channels.values())
          .filter((c) => c.serverId === us.activeServerId && c.type !== "PARENT")
          .sort((a, b) => a.position - b.position);
        if (channels.length === 0) return;
        const idx = channels.findIndex((c) => c.id === us.activeChannelId);
        const next = e.key === "ArrowDown"
          ? channels[Math.min(idx + 1, channels.length - 1)]
          : channels[Math.max(idx - 1, 0)];
        if (next) us.navigateToChannel(us.activeServerId, next.id);
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const activeServerId = useUIStore((s) => s.activeServerId);
  const activeView = useUIStore((s) => s.activeView);
  const memberListOpen = useUIStore((s) => s.memberListOpen);
  const modal = useUIStore((s) => s.modal);
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const isVoiceConnected = useVoiceStore((s) => s.currentRoomId !== null);
  const showDmSidebar = !activeServerId && (activeView === "friends" || activeView === "dm");

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${isVoiceConnected ? "pb-12" : ""}`}>
      <TitleBar />
      <ConnectionBanner />
      <div className="flex flex-1 min-h-0">
      <ArcSidebar />
      {activeServerId && <ChannelSidebar serverId={activeServerId} />}
      {showDmSidebar && <DmSidebar />}
      <ContentArea />
      {activeServerId && memberListOpen && <MemberList serverId={activeServerId} />}
      <SettingsModal open={modal === "settings"} onClose={() => useUIStore.getState().closeModal()} />
      <VoiceStatusBar />
      {incomingCall && (
        <DmCallBanner
          dmConversationId={incomingCall.dmConversationId}
          callerId={incomingCall.callerId}
          onDismiss={() => setIncomingCall(null)}
        />
      )}
      <ConfirmDialog />
      <CommandPalette open={commandPaletteOpen} onClose={() => useUIStore.getState().closeCommandPalette()} />
      </div>
    </div>
  );
}
