import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store/ui.store";
import { Tooltip } from "../ui/Tooltip";

export function AddServerButton() {
  const { t } = useTranslation("server");
  return (
    <Tooltip content={t("create.title")} side="right">
      <button
        onClick={() => useUIStore.getState().openModal("createServer")}
        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-elevated-2 text-live hover:rounded-xl hover:bg-live hover:text-text-inverse hover:shadow-lg hover:shadow-live/20 active:scale-95 transition-all duration-[var(--duration-hover)]"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </Tooltip>
  );
}
