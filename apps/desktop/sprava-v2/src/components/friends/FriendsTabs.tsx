import type React from "react";
import { useTranslation } from "react-i18next";

type Tab = "all" | "online" | "pending" | "add";

interface FriendsTabsProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  pendingCount: number;
}

const s = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const tabIcons: Record<string, React.ReactNode> = {
  all: <svg {...s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  online: <svg {...s}><circle cx="12" cy="12" r="3" fill="currentColor" /><path d="M12 2a10 10 0 110 20 10 10 0 010-20z" /></svg>,
  pending: <svg {...s}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
};

const tabKeys: { id: Tab; key: string }[] = [
  { id: "all", key: "tabs.all" },
  { id: "online", key: "tabs.online" },
  { id: "pending", key: "tabs.pending" },
];

export function FriendsTabs({ active, onChange, pendingCount }: FriendsTabsProps) {
  const { t } = useTranslation("friends");
  return (
    <div className="flex items-center gap-1">
      {tabKeys.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors duration-[var(--duration-feedback)] ${
            active === tab.id
              ? "bg-elevated-2 text-text-primary"
              : "text-text-secondary hover:bg-elevated hover:text-text-primary"
          }`}
        >
          <span className="opacity-70">{tabIcons[tab.id]}</span>
          {t(tab.key)}
          {tab.id === "pending" && pendingCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-danger text-white rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
      ))}
      <button
        onClick={() => onChange("add")}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors duration-[var(--duration-feedback)] ${
          active === "add"
            ? "bg-live text-text-inverse"
            : "bg-live/20 text-live hover:bg-live/30"
        }`}
      >
        <svg {...s}><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
        {t("tabs.addFriend")}
      </button>
    </div>
  );
}

export type { Tab };
