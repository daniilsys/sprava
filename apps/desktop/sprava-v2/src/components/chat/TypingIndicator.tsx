import { useTranslation } from "react-i18next";

interface TypingIndicatorProps {
  names: string[];
}

export function TypingIndicator({ names }: TypingIndicatorProps) {
  const { t } = useTranslation("chat");

  if (names.length === 0) return null;

  const text =
    names.length === 1
      ? t("typing.one", { name: names[0] })
      : names.length === 2
        ? t("typing.two", { name1: names[0], name2: names[1] })
        : t("typing.many", { count: names.length });

  return (
    <div className="px-4 h-6 flex items-center animate-fade-slide-up">
      <span className="text-xs text-text-secondary flex items-center gap-1.5">
        <span className="flex gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-typing-dot [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-typing-dot [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-typing-dot [animation-delay:300ms]" />
        </span>
        {text}...
      </span>
    </div>
  );
}
