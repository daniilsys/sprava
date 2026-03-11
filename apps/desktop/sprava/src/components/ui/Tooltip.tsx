import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content?: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

const OFFSET = 8;

export function Tooltip({ content, children, side = "top", delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const rect = trigger.getBoundingClientRect();
    const tt = tooltip.getBoundingClientRect();

    let x = 0;
    let y = 0;

    switch (side) {
      case "right":
        x = rect.right + OFFSET;
        y = rect.top + rect.height / 2 - tt.height / 2;
        break;
      case "left":
        x = rect.left - tt.width - OFFSET;
        y = rect.top + rect.height / 2 - tt.height / 2;
        break;
      case "bottom":
        x = rect.left + rect.width / 2 - tt.width / 2;
        y = rect.bottom + OFFSET;
        break;
      case "top":
      default:
        x = rect.left + rect.width / 2 - tt.width / 2;
        y = rect.top - tt.height - OFFSET;
        break;
    }

    // Clamp to viewport
    x = Math.max(4, Math.min(x, window.innerWidth - tt.width - 4));
    y = Math.max(4, Math.min(y, window.innerHeight - tt.height - 4));

    setPos({ x, y });
  }, [side]);

  useLayoutEffect(() => {
    if (visible) computePosition();
  }, [visible, computePosition]);

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  if (!content) return <>{children}</>;

  return (
    <div ref={triggerRef} className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-[9999] whitespace-nowrap rounded-lg bg-elevated-2 border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-xl pointer-events-none animate-tooltip"
            style={{ left: pos.x, top: pos.y }}
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
