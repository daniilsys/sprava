import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useVoice } from "../../hooks/useVoice";
import { useChannelPermission } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";
import { Tooltip } from "../ui/Tooltip";
import { VoicePeer } from "./VoicePeer";
import { VoiceControls } from "./VoiceControls";
import { VideoGrid } from "./VideoGrid";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import type { Channel, Member, PaginatedResponse } from "../../types/models";

interface VoiceChannelViewProps {
  channel: Channel;
}

export function VoiceChannelView({ channel }: VoiceChannelViewProps) {
  const { t } = useTranslation(["voice", "common"]);
  const { isConnected, joining, join, currentContextId, speaking, mutedPeers, deafenedPeers, isMuted, isDeafened } = useVoice();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const canJoinVoice = useChannelPermission(channel.serverId, channel.id, P.JOIN_VOICE);
  const voiceStates = useAppStore((s) => s.voiceStates);
  const memberMap = useAppStore((s) => s.members.get(channel.serverId));

  const isInThisChannel = isConnected && currentContextId === channel.id;
  const roomId = `channel:${channel.id}`;

  const othersInRoom = Array.from(voiceStates.values()).filter((vs) => vs.roomId === roomId && vs.userId !== currentUserId);

  // Fetch server members if voice peers are missing from the store
  const fetchingRef = useRef(false);
  useEffect(() => {
    const missing = othersInRoom.some((vs) => !memberMap?.get(vs.userId));
    if (!missing || fetchingRef.current) return;
    fetchingRef.current = true;
    api.servers.getMembers(channel.serverId, undefined, 50)
      .then((raw) => {
        const result = raw as PaginatedResponse<Member>;
        useAppStore.getState().appendMembers(channel.serverId, result.data);
      })
      .catch(() => {})
      .finally(() => { fetchingRef.current = false; });
  }, [channel.serverId, othersInRoom, memberMap]);
  const totalConnected = othersInRoom.length + (isInThisChannel ? 1 : 0);

  const handleJoin = async () => {
    try {
      await join(channel.id, "channel");
    } catch (e) {
      console.error("Failed to join voice:", e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
    <div className="flex flex-col items-center justify-center gap-6 min-h-full py-6">
      <div className="text-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-text-muted mb-3">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
        </svg>
        <h2 className="text-lg font-medium text-text-primary">{channel.name}</h2>
        <p className="text-sm text-text-muted mt-1">
          {totalConnected > 0
            ? t("channelView.usersConnected", { count: totalConnected })
            : t("channelView.empty")}
        </p>
      </div>

      {isInThisChannel && <VideoGrid />}

      {totalConnected > 0 && (
        <div className="w-64 space-y-1">
          {isInThisChannel && currentUserId && (
            <VoicePeer userId={currentUserId} isSelf isSpeaking={speaking.has(currentUserId)} isMuted={isMuted} isDeafened={isDeafened} />
          )}
          {othersInRoom.map((vs) => (
            <VoicePeer key={vs.userId} userId={vs.userId} isSpeaking={speaking.has(vs.userId)} isMuted={mutedPeers.has(vs.userId)} isDeafened={deafenedPeers.has(vs.userId)} />
          ))}
        </div>
      )}

      {isInThisChannel ? (
        <VoiceControls />
      ) : (
        <Tooltip content={!canJoinVoice ? t("common:permissions.noJoinVoice") : undefined}>
          <Button onClick={handleJoin} loading={joining} size="lg" disabled={!canJoinVoice}>
            {t("voice:channelView.joinVoice")}
          </Button>
        </Tooltip>
      )}
    </div>
    </div>
  );
}
