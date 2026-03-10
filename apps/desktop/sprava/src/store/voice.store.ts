import { create } from "zustand";

interface VoicePeer {
  userId: string;
  producerId?: string;
  consumerId?: string;
  stream?: MediaStream;
}

export interface VideoStreamEntry {
  kind: "camera" | "screen";
  stream: MediaStream;
}

interface VoiceState {
  currentRoomId: string | null;
  currentRoomType: "channel" | "dm" | null;
  currentContextId: string | null;
  localStream: MediaStream | null;
  peers: Map<string, VoicePeer>;
  speaking: Set<string>; // userIds currently speaking
  mutedPeers: Set<string>; // userIds that are muted
  deafenedPeers: Set<string>; // userIds that are deafened
  isMuted: boolean;
  isDeafened: boolean;
  joining: boolean;
  screenShareProducerId: string | null;
  cameraProducerId: string | null;
  videoStreams: Map<string, VideoStreamEntry>; // keyed by `${userId}:${kind}`
  /** Tracks remote peers' active video producers: `${userId}:${kind}` → producerId */
  activeVideoProducers: Map<string, string>;

  setRoom(roomId: string | null, type: "channel" | "dm" | null, contextId: string | null): void;
  setLocalStream(stream: MediaStream | null): void;
  addPeer(userId: string, peer?: Partial<VoicePeer>): void;
  updatePeer(userId: string, update: Partial<VoicePeer>): void;
  removePeer(userId: string): void;
  clearPeers(): void;
  setSpeaking(userId: string, isSpeaking: boolean): void;
  setPeerMuted(userId: string, muted: boolean): void;
  setPeerDeafened(userId: string, deafened: boolean): void;
  toggleMute(): void;
  toggleDeafen(): void;
  setJoining(joining: boolean): void;
  setScreenShareProducerId(id: string | null): void;
  setCameraProducerId(id: string | null): void;
  addVideoStream(userId: string, kind: "camera" | "screen", stream?: MediaStream): void;
  removeVideoStream(userId: string, kind: "camera" | "screen"): void;
  setActiveVideoProducer(userId: string, kind: "camera" | "screen", producerId: string): void;
  removeActiveVideoProducer(userId: string, kind: "camera" | "screen"): void;
  reset(): void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  currentRoomId: null,
  currentRoomType: null,
  currentContextId: null,
  localStream: null,
  peers: new Map(),
  speaking: new Set(),
  mutedPeers: new Set(),
  deafenedPeers: new Set(),
  isMuted: false,
  isDeafened: false,
  joining: false,
  screenShareProducerId: null,
  cameraProducerId: null,
  videoStreams: new Map(),
  activeVideoProducers: new Map(),

  setRoom(roomId, type, contextId) {
    set({ currentRoomId: roomId, currentRoomType: type, currentContextId: contextId });
  },

  setLocalStream(stream) {
    set({ localStream: stream });
  },

  addPeer(userId, peer) {
    set((s) => {
      const peers = new Map(s.peers);
      peers.set(userId, { userId, ...peer });
      return { peers };
    });
  },

  updatePeer(userId, update) {
    set((s) => {
      const peers = new Map(s.peers);
      const existing = peers.get(userId);
      if (existing) {
        peers.set(userId, { ...existing, ...update });
      }
      return { peers };
    });
  },

  removePeer(userId) {
    set((s) => {
      const peers = new Map(s.peers);
      const peer = peers.get(userId);
      if (peer?.stream) {
        peer.stream.getTracks().forEach((t) => t.stop());
      }
      peers.delete(userId);
      const speaking = new Set(s.speaking);
      speaking.delete(userId);
      const mutedPeers = new Set(s.mutedPeers);
      mutedPeers.delete(userId);
      const deafenedPeers = new Set(s.deafenedPeers);
      deafenedPeers.delete(userId);
      return { peers, speaking, mutedPeers, deafenedPeers };
    });
  },

  clearPeers() {
    set((s) => {
      for (const peer of s.peers.values()) {
        if (peer.stream) peer.stream.getTracks().forEach((t) => t.stop());
      }
      return { peers: new Map(), speaking: new Set(), mutedPeers: new Set(), deafenedPeers: new Set() };
    });
  },

  setSpeaking(userId, isSpeaking) {
    set((s) => {
      const speaking = new Set(s.speaking);
      if (isSpeaking) speaking.add(userId);
      else speaking.delete(userId);
      return { speaking };
    });
  },

  setPeerMuted(userId, muted) {
    set((s) => {
      const mutedPeers = new Set(s.mutedPeers);
      if (muted) mutedPeers.add(userId);
      else mutedPeers.delete(userId);
      return { mutedPeers };
    });
  },

  setPeerDeafened(userId, deafened) {
    set((s) => {
      const deafenedPeers = new Set(s.deafenedPeers);
      if (deafened) deafenedPeers.add(userId);
      else deafenedPeers.delete(userId);
      return { deafenedPeers };
    });
  },

  toggleMute() {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    }
    const newMuted = !isMuted;
    set({ isMuted: newMuted });

    // Broadcast mute state to other peers
    import("../lib/socket").then(({ getSocket }) => {
      const socket = getSocket();
      socket?.emit("voice:mute_state", { muted: newMuted });
    });
  },

  toggleDeafen() {
    const { isDeafened, peers } = get();
    for (const peer of peers.values()) {
      if (peer.stream) {
        peer.stream.getAudioTracks().forEach((t) => { t.enabled = isDeafened; });
      }
    }
    const newDeafened = !isDeafened;
    set({ isDeafened: newDeafened });

    // Broadcast deafen state to other peers
    import("../lib/socket").then(({ getSocket }) => {
      const socket = getSocket();
      socket?.emit("voice:deafen_state", { deafened: newDeafened });
    });
  },

  setJoining(joining) {
    set({ joining });
  },

  setScreenShareProducerId(id) {
    set({ screenShareProducerId: id });
  },

  setCameraProducerId(id) {
    set({ cameraProducerId: id });
  },

  addVideoStream(userId, kind, stream) {
    set((s) => {
      const videoStreams = new Map(s.videoStreams);
      const key = `${userId}:${kind}`;
      if (stream) {
        videoStreams.set(key, { kind, stream });
      } else {
        // Placeholder entry — stream will be set when the consumer is ready
        videoStreams.set(key, { kind, stream: new MediaStream() });
      }
      return { videoStreams };
    });
  },

  removeVideoStream(userId, kind) {
    set((s) => {
      const videoStreams = new Map(s.videoStreams);
      const key = `${userId}:${kind}`;
      const entry = videoStreams.get(key);
      if (entry?.stream) {
        entry.stream.getTracks().forEach((t) => t.stop());
      }
      videoStreams.delete(key);
      return { videoStreams };
    });
  },

  setActiveVideoProducer(userId, kind, producerId) {
    set((s) => {
      const activeVideoProducers = new Map(s.activeVideoProducers);
      activeVideoProducers.set(`${userId}:${kind}`, producerId);
      return { activeVideoProducers };
    });
  },

  removeActiveVideoProducer(userId, kind) {
    set((s) => {
      const activeVideoProducers = new Map(s.activeVideoProducers);
      activeVideoProducers.delete(`${userId}:${kind}`);
      return { activeVideoProducers };
    });
  },

  reset() {
    const { localStream, videoStreams } = get();
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    for (const entry of videoStreams.values()) {
      entry.stream.getTracks().forEach((t) => t.stop());
    }
    get().clearPeers();
    set({
      currentRoomId: null,
      currentRoomType: null,
      currentContextId: null,
      localStream: null,
      isMuted: false,
      isDeafened: false,
      joining: false,
      speaking: new Set(),
      mutedPeers: new Set(),
      deafenedPeers: new Set(),
      screenShareProducerId: null,
      cameraProducerId: null,
      videoStreams: new Map(),
      activeVideoProducers: new Map(),
    });
  },
}));
