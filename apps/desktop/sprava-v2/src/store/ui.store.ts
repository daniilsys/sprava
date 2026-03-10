import { create } from "zustand";
import { useAppStore } from "./app.store";

type ActiveView = "friends" | "channel" | "dm";
type ModalType = "createServer" | "joinServer" | "settings" | null;
type SocketStatus = "connected" | "connecting" | "disconnected";

// Persist last channel per server
function loadLastChannels(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("lastChannelByServer") || "{}");
  } catch {
    return {};
  }
}

function saveLastChannel(serverId: string, channelId: string) {
  const map = loadLastChannels();
  map[serverId] = channelId;
  localStorage.setItem("lastChannelByServer", JSON.stringify(map));
}

// Persist muted contexts
function loadMutedContexts(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem("mutedContexts") || "[]"));
  } catch {
    return new Set();
  }
}

interface UIState {
  activeServerId: string | null;
  activeChannelId: string | null;
  activeDmId: string | null;
  activeView: ActiveView;
  modal: ModalType;
  replyingTo: { id: string; content: string; author: string } | null;
  memberListOpen: boolean;
  commandPaletteOpen: boolean;
  socketStatus: SocketStatus;
  mutedContexts: Set<string>;
  searchPanelOpen: boolean;
  pinnedPanelOpen: boolean;
  fontSize: "small" | "medium" | "large";

  navigateToServer(serverId: string): void;
  navigateToChannel(serverId: string, channelId: string): void;
  navigateToDm(dmId: string): void;
  navigateToFriends(): void;
  openModal(type: "createServer" | "joinServer" | "settings"): void;
  closeModal(): void;
  setReplyingTo(
    reply: { id: string; content: string; author: string } | null,
  ): void;
  toggleMemberList(): void;
  openCommandPalette(): void;
  closeCommandPalette(): void;
  setSocketStatus(status: SocketStatus): void;
  toggleMuteContext(contextId: string): void;
  isContextMuted(contextId: string): boolean;
  toggleSearchPanel(): void;
  togglePinnedPanel(): void;
  setFontSize(size: "small" | "medium" | "large"): void;
}

// Load persisted font size
function loadFontSize(): "small" | "medium" | "large" {
  const saved = localStorage.getItem("fontSize");
  if (saved === "small" || saved === "medium" || saved === "large") return saved;
  return "medium";
}

export const useUIStore = create<UIState>((set, get) => ({
  activeServerId: null,
  activeChannelId: null,
  activeDmId: null,
  activeView: "friends",
  modal: null,
  replyingTo: null,
  memberListOpen: localStorage.getItem("memberListOpen") === "true",
  commandPaletteOpen: false,
  socketStatus: "connecting",
  mutedContexts: loadMutedContexts(),
  searchPanelOpen: false,
  pinnedPanelOpen: false,
  fontSize: loadFontSize(),

  navigateToServer(serverId) {
    const channels = useAppStore.getState().channels;
    const serverChannels = Array.from(channels.values())
      .filter((c) => c.serverId === serverId && c.type === "TEXT")
      .sort((a, b) => a.position - b.position);

    // Try last visited channel first
    const lastChannels = loadLastChannels();
    const lastChannelId = lastChannels[serverId];
    const lastChannel = lastChannelId ? channels.get(lastChannelId) : undefined;
    const targetChannel = lastChannel && lastChannel.serverId === serverId
      ? lastChannel
      : serverChannels[0];

    set({
      activeServerId: serverId,
      activeChannelId: targetChannel?.id || null,
      activeDmId: null,
      activeView: "channel",
    });
  },

  navigateToChannel(serverId, channelId) {
    saveLastChannel(serverId, channelId);
    set({
      activeServerId: serverId,
      activeChannelId: channelId,
      activeDmId: null,
      activeView: "channel",
    });
  },

  navigateToDm(dmId) {
    set({
      activeServerId: null,
      activeChannelId: null,
      activeDmId: dmId,
      activeView: "dm",
    });
  },

  navigateToFriends() {
    set({
      activeServerId: null,
      activeChannelId: null,
      activeDmId: null,
      activeView: "friends",
    });
  },

  openModal(type) {
    set({ modal: type });
  },

  closeModal() {
    set({ modal: null });
  },

  setReplyingTo(reply) {
    set({ replyingTo: reply });
  },

  openCommandPalette() {
    set({ commandPaletteOpen: true });
  },

  closeCommandPalette() {
    set({ commandPaletteOpen: false });
  },

  toggleMemberList() {
    set((s) => {
      const next = !s.memberListOpen;
      localStorage.setItem("memberListOpen", String(next));
      return { memberListOpen: next };
    });
  },

  setSocketStatus(status) {
    set({ socketStatus: status });
  },

  toggleMuteContext(contextId) {
    set((s) => {
      const next = new Set(s.mutedContexts);
      if (next.has(contextId)) next.delete(contextId);
      else next.add(contextId);
      localStorage.setItem("mutedContexts", JSON.stringify([...next]));
      return { mutedContexts: next };
    });
  },

  isContextMuted(contextId) {
    return get().mutedContexts.has(contextId);
  },

  toggleSearchPanel() {
    set((s) => ({ searchPanelOpen: !s.searchPanelOpen, pinnedPanelOpen: false }));
  },

  togglePinnedPanel() {
    set((s) => ({ pinnedPanelOpen: !s.pinnedPanelOpen, searchPanelOpen: false }));
  },

  setFontSize(size) {
    localStorage.setItem("fontSize", size);
    document.documentElement.style.setProperty(
      "--font-size-base",
      size === "small" ? "13px" : size === "large" ? "16px" : "14px",
    );
    set({ fontSize: size });
  },
}));

// Apply font size on load
const initialSize = loadFontSize();
document.documentElement.style.setProperty(
  "--font-size-base",
  initialSize === "small" ? "13px" : initialSize === "large" ? "16px" : "14px",
);
