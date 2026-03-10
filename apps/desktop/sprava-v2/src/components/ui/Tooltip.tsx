import { useState, useRef } from "react";

interface TooltipProps {
  content?: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

const positionClasses = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const caretClasses = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-elevated-2 border-x-transparent border-b-transparent",
  bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-elevated-2 border-x-transparent border-t-transparent",
  left: "left-full top-1/2 -translate-y-1/2 border-l-elevated-2 border-y-transparent border-r-transparent",
  right: "right-full top-1/2 -translate-y-1/2 border-r-elevated-2 border-y-transparent border-l-transparent",
};

export function Tooltip({ content, children, side = "top", delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  if (!content) return <>{children}</>;

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className={`absolute z-50 whitespace-nowrap rounded-lg bg-elevated-2 border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-xl pointer-events-none animate-tooltip ${positionClasses[side]}`}
        >
          {content}
          <span
            className={`absolute w-0 h-0 border-[5px] ${caretClasses[side]}`}
          />
        </div>
      )}
    </div>
  );
}
