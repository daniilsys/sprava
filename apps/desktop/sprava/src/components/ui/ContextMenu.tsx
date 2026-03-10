import type React from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  variant?: "danger";
  icon?: React.ReactNode;
  separator?: never;
}

export interface ContextMenuSeparator {
  separator: true;
  label?: never;
  onClick?: never;
  variant?: never;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use setTimeout to avoid catching the same right-click event
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Adjust position to keep menu in viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36 - 16);

  return createPortal(
    <div
      ref={ref}
      className="fixed bg-elevated border border-border-subtle rounded-lg shadow-xl py-1 z-[200] min-w-[160px] animate-scale-in"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${i}`}
              className="my-1 border-t border-border-subtle"
            />
          );
        }
        return (
          <button
            key={item.label}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`w-full text-left px-3 py-1.5 text-sm rounded-md mx-1 transition-colors flex items-center gap-2 ${
              item.variant === "danger"
                ? "text-danger hover:bg-danger/10"
                : "text-text-secondary hover:bg-elevated-2 hover:text-text-primary"
            }`}
          >
            {item.icon && <span className="w-4 h-4 flex-shrink-0 opacity-70">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

