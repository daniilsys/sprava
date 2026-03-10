import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store/ui.store";
import { useAppStore } from "../../store/app.store";
import { MessageArea } from "../chat/MessageArea";
import { FriendsPage } from "../friends/FriendsPage";
import { VoiceChannelView } from "../voice/VoiceChannelView";

export function ContentArea() {
  const { t } = useTranslation("common");
  const activeView = useUIStore((s) => s.activeView);
  const activeChannelId = useUIStore((s) => s.activeChannelId);
  const activeDmId = useUIStore((s) => s.activeDmId);
  const channel = useAppStore((s) =>
    activeChannelId ? s.channels.get(activeChannelId) : undefined,
  );

  const isVoice = channel?.type === "VOICE";

  // Track view changes for transition
  const viewKey = `${activeView}-${activeChannelId}-${activeDmId}`;
  const [transitionKey, setTransitionKey] = useState(viewKey);
  const [transitioning, setTransitioning] = useState(false);
  const prevKey = useRef(viewKey);

  useEffect(() => {
    if (viewKey !== prevKey.current) {
      prevKey.current = viewKey;
      // Voice channels load instantly — skip the blank frame
      if (isVoice) {
        setTransitionKey(viewKey);
        setTransitioning(false);
      } else {
        setTransitioning(true);
        const t = setTimeout(() => {
          setTransitionKey(viewKey);
          setTransitioning(false);
        }, 50);
        return () => clearTimeout(t);
      }
    }
  }, [viewKey, isVoice]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-surface">
      <div
        key={transitionKey}
        className={`flex-1 flex flex-col min-h-0 ${transitioning ? "opacity-0" : "view-transition-enter"}`}
      >
        {activeView === "channel" && activeChannelId && !isVoice && (
          <MessageArea contextId={activeChannelId} type="channel" />
        )}
        {activeView === "channel" && activeChannelId && isVoice && channel && (
          <VoiceChannelView channel={channel} />
        )}
        {activeView === "dm" && activeDmId && (
          <MessageArea contextId={activeDmId} type="dm" />
        )}
        {activeView === "friends" && <FriendsPage />}
        {activeView === "channel" && !activeChannelId && (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            <div className="text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-40">
                <line x1="4" y1="9" x2="20" y2="9" />
                <line x1="4" y1="15" x2="20" y2="15" />
                <line x1="10" y1="3" x2="8" y2="21" />
                <line x1="16" y1="3" x2="14" y2="21" />
              </svg>
              <p className="text-sm font-medium">{t("selectChannel")}</p>
              <p className="text-xs mt-1 text-text-muted">{t("selectChannelHint")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
