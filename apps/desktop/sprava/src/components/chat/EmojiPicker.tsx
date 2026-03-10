import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const COMMON_EMOJIS = [
  "\u{1F44D}", "\u{1F44E}", "\u{2764}\u{FE0F}", "\u{1F602}", "\u{1F60A}",
  "\u{1F60E}", "\u{1F914}", "\u{1F440}", "\u{1F389}", "\u{1F525}",
  "\u{2705}", "\u{274C}", "\u{1F44F}", "\u{1F64F}", "\u{1F60D}",
  "\u{1F62D}", "\u{1F621}", "\u{1F631}", "\u{1F4AF}", "\u{1F680}",
  "\u{1F308}", "\u{2B50}", "\u{1F381}", "\u{1F3C6}", "\u{1F48E}",
  "\u{1F64C}", "\u{1F596}", "\u{270C}\u{FE0F}", "\u{1F4A1}", "\u{1F4AC}",
];

export function EmojiPicker({ onSelect, onClose, anchorRef }: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const pickerW = 222; // 6 cols * 32px + padding + gaps
    const pickerH = 200;

    let top = rect.top - pickerH - 8;
    let left = rect.left + rect.width / 2 - pickerW / 2;

    // Clamp to viewport
    if (top < 8) top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;

    setPos({ top, left });
  }, [anchorRef]);

  const picker = (
    <div
      ref={pickerRef}
      className="bg-elevated border border-border-subtle rounded-xl p-3 shadow-xl"
      style={pos ? { position: "fixed", top: pos.top, left: pos.left, zIndex: 100 } : { position: "absolute", bottom: "100%", right: 0, marginBottom: 8, zIndex: 50 }}
    >
      <div className="grid grid-cols-6 gap-1">
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-elevated-2 transition-colors text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[90]" onClick={onClose} />,
        document.body,
      )}
      {anchorRef
        ? createPortal(picker, document.body)
        : picker
      }
    </>
  );
}
