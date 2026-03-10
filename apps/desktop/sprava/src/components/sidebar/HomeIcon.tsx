import { useUIStore } from "../../store/ui.store";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { Tooltip } from "../ui/Tooltip";

export function HomeIcon() {
  const activeView = useUIStore((s) => s.activeView);
  const isActive = activeView === "friends" && !useUIStore.getState().activeServerId;

  const hasUnread = useAppStore((s) => {
    useAuthStore.getState().user?.id;
    for (const dm of s.dms.values()) {
      if (dm.lastMessageId) {
        const lastRead = s.readStates.get(dm.id);
        if (!lastRead || lastRead < dm.lastMessageId) return true;
      }
    }
    return false;
  });

  return (
    <Tooltip content="Direct Messages" side="right">
      <div className="relative flex items-center justify-center">
        {isActive && (
          <div className="absolute -left-1 w-1 h-8 rounded-r-full bg-primary animate-indicator" />
        )}
        {!isActive && hasUnread && (
          <div className="absolute -left-1 w-1 h-2 rounded-r-full bg-text-primary animate-badge-pop" />
        )}
        <button
          onClick={() => useUIStore.getState().navigateToFriends()}
          className={`w-12 h-12 flex items-center justify-center overflow-hidden transition-all duration-[var(--duration-hover)] ${
            isActive
              ? "rounded-xl bg-primary text-text-inverse shadow-lg shadow-primary/20"
              : "rounded-2xl bg-elevated-2 text-text-secondary hover:rounded-xl hover:bg-primary hover:text-text-inverse hover:shadow-lg hover:shadow-primary/20"
          }`}
        >
          <svg
            width="28"
            height="28"
            viewBox="24 24 208 208"
            role="img"
          >
            <rect x="36" y="36" width="184" height="184" rx="56" fill="currentColor" opacity="0.15" />
            <circle cx="98" cy="108" r="14" fill="currentColor" />
            <circle cx="158" cy="108" r="14" fill="currentColor" />
            <path d="M88 158 Q104 140 120 158 T152 158 T184 158" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
        {/* Unread badge */}
        {hasUnread && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-danger border-2 border-elevated-1 animate-badge-pop" />
        )}
      </div>
    </Tooltip>
  );
}
