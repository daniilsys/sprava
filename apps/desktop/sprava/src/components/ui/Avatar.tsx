import { useState } from "react";
import type { UserStatus } from "../../types/models";

type Size = "xs" | "sm" | "md" | "lg";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: Size;
  online?: boolean;
  status?: UserStatus;
  className?: string;
}

const sizeClasses: Record<Size, string> = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

const dotSizes: Record<Size, string> = {
  xs: "w-2 h-2",
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
  lg: "w-3.5 h-3.5",
};

const statusColors: Record<UserStatus, string> = {
  online: "bg-live",
  idle: "bg-amber-400",
  dnd: "bg-danger",
  offline: "bg-text-muted",
};

function getInitials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function Avatar({
  src,
  name,
  size = "md",
  online,
  status,
  className = "",
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  // Determine which status to show: explicit status prop takes priority
  const resolvedStatus: UserStatus | undefined = status ?? (online !== undefined ? (online ? "online" : "offline") : undefined);

  return (
    <div className={`relative inline-flex flex-shrink-0 rounded-full ${className}`}>
      {src && !imgFailed ? (
        <img
          src={src}
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover`}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full bg-elevated-2 flex items-center justify-center font-medium text-text-secondary`}
        >
          {getInitials(name)}
        </div>
      )}
      {resolvedStatus !== undefined && (
        <span
          className={`absolute bottom-0 right-0 ${dotSizes[size]} rounded-full border-2 border-bg ${statusColors[resolvedStatus]}`}
        />
      )}
    </div>
  );
}
