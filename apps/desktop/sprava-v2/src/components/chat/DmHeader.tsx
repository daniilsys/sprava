import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Avatar } from "../ui/Avatar";
import { IconButton } from "../ui/IconButton";
import { Tooltip } from "../ui/Tooltip";
import { UserProfilePopup } from "../user/UserProfilePopup";
import { VoiceControls } from "../voice/VoiceControls";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { useVoice } from "../../hooks/useVoice";
import { useVoiceStore } from "../../store/voice.store";
import type { VideoStreamEntry } from "../../store/voice.store";
import { rewatchStream, stopWatchingStream } from "../../lib/voice";
import { api } from "../../lib/api";
import type { DmConversation, Message } from "../../types/models";

/* ── Compact video tile for DM call header ── */
function DmVideoTile({ userId, entry, isSelf, onFullscreen }: { userId: string; entry: VideoStreamEntry; isSelf: boolean; onFullscreen: () => void }) {
  const { t } = useTranslation("voice");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const currentUser = useAuthStore((s) => s.user);
  const dmUser = useAppStore((s) => {
    for (const dm of s.dms.values()) {
      const p = dm.participants?.find((pp) => pp.userId === userId);
      if (p?.user) return p.user;
    }
    return undefined;
  });
  const username = isSelf ? (currentUser?.username ?? "You") : (dmUser?.username ?? userId.slice(-6));

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = entry.stream;
    el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [entry.stream]);

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
      {/* Bottom gradient overlay — always visible for label readability */}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
      {/* Username + kind label */}
      <div className="absolute bottom-2 left-2.5 flex items-center gap-1.5 pointer-events-none">
        <span className="text-[11px] text-white/90 font-medium truncate max-w-[120px] drop-shadow-sm">
          {username}{isSelf ? t("video.youSuffix") : ""}
        </span>
        <span className="text-[9px] text-white/50 uppercase tracking-wider">
          {entry.kind === "screen" ? t("video.screen") : t("video.camera")}
        </span>
      </div>
      {/* Action buttons on hover */}
      {hovered && (
        <div className="absolute top-2 right-2 flex items-center gap-1 animate-in fade-in duration-150">
          <button
            onClick={(e) => { e.stopPropagation(); onFullscreen(); }}
            className="p-1.5 rounded-md bg-white/10 backdrop-blur-md hover:bg-white/20 text-white/80 hover:text-white transition-all"
            title={t("video.fullscreen")}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          {!isSelf && (
            <button
              onClick={(e) => { e.stopPropagation(); stopWatchingStream(userId, entry.kind); }}
              className="p-1.5 rounded-md bg-white/10 backdrop-blur-md hover:bg-danger/60 text-white/80 hover:text-white transition-all"
              title={t("video.stopWatching")}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Stable fullscreen video (no re-render flash) ── */
function FullscreenVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain rounded-2xl" />;
}

interface DmHeaderProps {
  dm: DmConversation;
  currentUserId: string;
  contextId: string;
  onJumpToMessage?: (messageId: string) => void;
}

/* ── Participant row — name + mute/deafen + stream buttons ── */
function CallPeer({
  avatar,
  name,
  userId,
  isSpeaking,
  isMuted,
  isDeafened,
  isSelf,
  user,
}: {
  avatar: string | null;
  name: string;
  userId: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSelf: boolean;
  user?: { id: string; username: string; avatar: string | null; displayName?: string | null; bio?: string | null; status?: string | null; createdAt?: string } | null;
}) {
  const { t } = useTranslation("voice");
  const [profileOpen, setProfileOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const screenProducerActive = useVoiceStore((s) => s.activeVideoProducers.has(`${userId}:screen`));
  const cameraProducerActive = useVoiceStore((s) => s.activeVideoProducers.has(`${userId}:camera`));
  const isWatchingScreen = useVoiceStore((s) => {
    const entry = s.videoStreams.get(`${userId}:screen`);
    return entry ? entry.stream.getVideoTracks().length > 0 : false;
  });
  const isWatchingCamera = useVoiceStore((s) => {
    const entry = s.videoStreams.get(`${userId}:camera`);
    return entry ? entry.stream.getVideoTracks().length > 0 : false;
  });

  const canWatchScreen = screenProducerActive && !isWatchingScreen;
  const canWatchCamera = cameraProducerActive && !isWatchingCamera;

  return (
    <>
      <div
        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
          isSpeaking ? "bg-live/8" : "hover:bg-white/[0.03]"
        }`}
        onClick={() => user && setProfileOpen(true)}
      >
        {/* Avatar */}
        <div
          ref={avatarRef}
          className={`inline-flex rounded-full flex-shrink-0 transition-shadow duration-300 ${
            isSpeaking ? "animate-speaking-ring" : ""
          }`}
          style={!isSpeaking ? { boxShadow: "0 0 0 2px transparent" } : undefined}
        >
          <Avatar src={avatar} name={name} size="xs" />
        </div>

        {/* Name */}
        <span className={`text-xs truncate flex-1 min-w-0 ${
          isSpeaking ? "text-live font-medium" : "text-text-secondary"
        }`}>
          {name}{isSelf ? <span className="text-text-muted"> {t("peer.youSuffix")}</span> : ""}
        </span>

        {/* Stream action buttons — clearly visible and clickable */}
        {(screenProducerActive || cameraProducerActive) && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {screenProducerActive && (
              <Tooltip content={
                isWatchingScreen
                  ? t("video.stopWatching")
                  : canWatchScreen
                    ? t("peer.watchScreenShare")
                    : t("peer.sharingScreen")
              } side="bottom">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isWatchingScreen) stopWatchingStream(userId, "screen");
                    else if (canWatchScreen) rewatchStream(userId, "screen");
                  }}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    isWatchingScreen
                      ? "bg-accent/20 text-accent hover:bg-accent/30"
                      : canWatchScreen
                        ? "bg-elevated-2 text-text-secondary hover:bg-accent/20 hover:text-accent"
                        : "bg-elevated-2/50 text-text-muted"
                  }`}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  {t("video.screen")}
                </button>
              </Tooltip>
            )}
            {cameraProducerActive && (
              <Tooltip content={
                isWatchingCamera
                  ? t("video.stopWatching")
                  : canWatchCamera
                    ? t("peer.watchCamera")
                    : t("peer.cameraOn")
              } side="bottom">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isWatchingCamera) stopWatchingStream(userId, "camera");
                    else if (canWatchCamera) rewatchStream(userId, "camera");
                  }}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    isWatchingCamera
                      ? "bg-secondary/20 text-secondary hover:bg-secondary/30"
                      : canWatchCamera
                        ? "bg-elevated-2 text-text-secondary hover:bg-secondary/20 hover:text-secondary"
                        : "bg-elevated-2/50 text-text-muted"
                  }`}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" />
                  </svg>
                  {t("video.camera")}
                </button>
              </Tooltip>
            )}
          </div>
        )}

        {/* Mute/deafen icon */}
        {isDeafened && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger flex-shrink-0">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9H4a1 1 0 00-1 1v4a1 1 0 001 1h2l5 5V6.5" />
            <path d="M19 9l-4 4m0-4l4 4" />
          </svg>
        )}
        {isMuted && !isDeafened && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger flex-shrink-0">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
            <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .72-.11 1.42-.31 2.07" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </div>

      {/* Profile popup */}
      {profileOpen && user && avatarRef.current && (
        <UserProfilePopup
          user={user as any}
          anchorRect={avatarRef.current.getBoundingClientRect()}
          preferPlacement="below"
          onClose={() => setProfileOpen(false)}
        />
      )}
    </>
  );
}

export function DmHeader({ dm, currentUserId, contextId, onJumpToMessage }: DmHeaderProps) {
  const { t } = useTranslation("chat");
  const { t: tv } = useTranslation("voice");
  const other = dm.participants?.find((p) => p.userId !== currentUserId);
  const otherUser = other?.user;
  const displayName = dm.name || otherUser?.username || "Direct Message";
  const presenceState = useAppStore((s) => otherUser ? s.presence.get(otherUser.id) : undefined);
  const status = presenceState?.status ?? "offline";

  const [profileOpen, setProfileOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const currentUser = useAuthStore((s) => s.user);
  const { join, isConnected, currentContextId, speaking, mutedPeers, deafenedPeers, isMuted, isDeafened, videoStreams } = useVoice();
  const isInThisCall = isConnected && currentContextId === contextId;

  // Call duration
  const [callDuration, setCallDuration] = useState(0);
  const callStartRef = useRef<number | null>(null);

  // Panel collapsed state
  const [panelExpanded, setPanelExpanded] = useState(true);

  useEffect(() => {
    if (isInThisCall) {
      callStartRef.current = Date.now();
      setCallDuration(0);
      const interval = setInterval(() => {
        if (callStartRef.current) {
          setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      callStartRef.current = null;
      setCallDuration(0);
    }
  }, [isInThisCall]);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const handleCall = () => {
    if (!isInThisCall) {
      join(contextId, "dm");
    }
  };

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await api.dm.searchMessages(contextId, q.trim()) as Message[];
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [contextId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => handleSearch(searchQuery), 2000);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  // Fullscreen video state — declared outside conditional to respect hooks rules
  const [fullscreenKey, setFullscreenKey] = useState<string | null>(null);

  // ═══════════════════════════════════════════
  //  IN-CALL HEADER
  // ═══════════════════════════════════════════
  if (isInThisCall) {
    const voiceStates = useAppStore.getState().voiceStates;
    const roomId = `dm:${contextId}`;
    const peersInCall = voiceStates.filter((vs) => vs.roomId === roomId && vs.userId !== currentUserId);
    const totalInCall = peersInCall.length + 1;

    const activeStreamEntries = Array.from(videoStreams.entries()).filter(
      ([, entry]) => entry.stream.getVideoTracks().length > 0,
    );
    const hasStreams = activeStreamEntries.length > 0;
    const fsEntry = fullscreenKey ? activeStreamEntries.find(([key]) => key === fullscreenKey) : null;

    // Close fullscreen if stream disappears
    if (fullscreenKey && !fsEntry) setFullscreenKey(null);

    return (
      <div className="flex-shrink-0 border-b border-border-subtle animate-fade-slide-down">
        {/* ── Call control bar ── */}
        <div
          className="relative h-11 flex items-center gap-3 px-4"
          style={{
            background: "linear-gradient(135deg, rgba(62,219,168,0.06) 0%, rgba(62,219,168,0.02) 50%, rgba(107,156,247,0.04) 100%)",
          }}
        >
          {/* Live indicator + call info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <span className="block w-2 h-2 rounded-full bg-live" />
              <span className="absolute inset-0 w-2 h-2 rounded-full bg-live animate-ping opacity-40" />
            </div>
            <span className="text-[13px] font-semibold text-live tracking-tight">
              {t("call.inCall")}
            </span>
            <span className="text-xs text-text-muted font-mono tabular-nums tracking-wider">
              {formatDuration(callDuration)}
            </span>
            <span className="text-xs text-text-muted">
              · {t("call.participant", { count: totalInCall })}
            </span>
          </div>

          <div className="flex-1" />

          {/* Expand/Collapse toggle */}
          <Tooltip content={panelExpanded ? t("call.collapse") : t("call.expand")} side="bottom">
            <button
              onClick={() => setPanelExpanded((v) => !v)}
              className="p-1 rounded-md hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-200 ${panelExpanded ? "" : "rotate-180"}`}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          </Tooltip>

          {/* Voice controls */}
          <VoiceControls />
        </div>

        {/* ── Expandable content ── */}
        {panelExpanded && (
          <div>
            {/* Video grid */}
            {hasStreams && (
              <div className="px-3 pt-2 pb-1">
                <div className={`grid ${activeStreamEntries.length === 1 ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
                  {activeStreamEntries.map(([key, entry]) => {
                    const uid = key.split(":")[0];
                    return (
                      <div
                        key={key}
                        className="relative rounded-xl overflow-hidden cursor-pointer ring-1 ring-white/[0.06] hover:ring-white/[0.12] transition-all"
                        style={{
                          height: activeStreamEntries.length === 1 ? "min(25vh, 280px)" : "min(17vh, 180px)",
                          minHeight: "100px",
                          background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                        }}
                        onClick={() => setFullscreenKey(key)}
                      >
                        <DmVideoTile userId={uid} entry={entry} isSelf={uid === currentUserId} onFullscreen={() => setFullscreenKey(key)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Participant list — always visible below video */}
            <div className="px-2 py-1.5 space-y-0.5 max-h-[30vh] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {/* Self */}
              <CallPeer
                avatar={currentUser?.avatar ?? null}
                name={currentUser?.username ?? tv("peer.you")}
                userId={currentUserId}
                isSpeaking={speaking.has(currentUserId)}
                isMuted={isMuted}
                isDeafened={isDeafened}
                isSelf
                user={currentUser}
              />

              {/* Others */}
              {peersInCall.map((vs) => {
                const p = dm.participants?.find((pp) => pp.userId === vs.userId);
                return (
                  <CallPeer
                    key={vs.userId}
                    avatar={p?.user?.avatar ?? null}
                    name={p?.user?.username ?? "?"}
                    userId={vs.userId}
                    isSpeaking={speaking.has(vs.userId)}
                    isMuted={mutedPeers.has(vs.userId)}
                    isDeafened={deafenedPeers.has(vs.userId)}
                    isSelf={false}
                    user={p?.user}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Fullscreen video overlay */}
        {fsEntry && createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-lightbox-in cursor-pointer"
            onClick={() => setFullscreenKey(null)}
          >
            <button
              onClick={() => setFullscreenKey(null)}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="w-[95vw] h-[90vh] animate-lightbox-img-in" onClick={(e) => e.stopPropagation()}>
              <FullscreenVideo stream={fsEntry[1].stream} />
            </div>
          </div>,
          document.body,
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  NORMAL HEADER (not in call)
  // ═══════════════════════════════════════════
  return (
    <div className="h-12 flex items-center gap-3 px-4 border-b border-border-subtle flex-shrink-0">
      <button
        onClick={() => setProfileOpen(true)}
        className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
      >
        <div ref={avatarRef}>
          <Avatar
            src={dm.type !== "GROUP" ? otherUser?.avatar ?? null : dm.icon}
            name={displayName}
            size="sm"
            status={dm.type !== "GROUP" ? status : undefined}
          />
        </div>
        <h3 className="font-medium text-sm text-text-primary">{displayName}</h3>
      </button>

      <div className="flex-1" />

      <IconButton
        size="sm"
        onClick={() => useUIStore.getState().togglePinnedPanel()}
        title={t("pinned.tooltip")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="17" x2="12" y2="22" />
          <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
        </svg>
      </IconButton>

      <div ref={searchContainerRef} className="relative">
        {searchOpen ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); setSearchResults([]); } }}
                placeholder={t("search.findMessage")}
                className="w-56 h-8 px-3 pr-8 text-sm bg-elevated border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
              />
              <svg
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>
        ) : (
          <IconButton size="sm" onClick={() => setSearchOpen(true)} title={t("search.tooltip")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </IconButton>
        )}

        {searchOpen && searchQuery.trim() && (
          <div className="absolute right-0 top-full mt-1 w-80 max-h-72 overflow-y-auto bg-elevated border border-border-subtle rounded-xl shadow-xl z-50">
            {searching && (
              <div className="px-4 py-3 text-sm text-text-muted">{t("search.searching")}</div>
            )}
            {!searching && searchResults.length === 0 && searchQuery.trim() && (
              <div className="px-4 py-3 text-sm text-text-muted">{t("search.noResults")}</div>
            )}
            {searchResults.map((msg) => (
              <div key={msg.id} className="px-4 py-2.5 hover:bg-elevated-2 transition-colors border-b border-border-subtle last:border-0 cursor-pointer" onClick={() => {
                onJumpToMessage?.(msg.id);
                setSearchOpen(false);
                setSearchQuery("");
                setSearchResults([]);
              }}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-medium text-text-primary">{msg.author.username}</span>
                  <span className="text-[10px] text-text-muted">
                    {new Date(msg.createdAt).toLocaleDateString()} {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm text-text-secondary line-clamp-2">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {dm.type !== "GROUP" && (
        <IconButton
          size="sm"
          onClick={handleCall}
          title={t("call.start")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
        </IconButton>
      )}

      {profileOpen && otherUser && avatarRef.current && (
        <UserProfilePopup
          user={otherUser}
          anchorRect={avatarRef.current.getBoundingClientRect()}
          preferPlacement="below"
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}
