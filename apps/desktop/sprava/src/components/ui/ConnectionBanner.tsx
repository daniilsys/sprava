import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store/ui.store";

export function ConnectionBanner() {
  const { t } = useTranslation("common");
  const status = useUIStore((s) => s.socketStatus);

  if (status === "connected") return null;

  return (
    <div
      className={`flex-shrink-0 px-4 py-1.5 text-xs font-medium text-center ${
        status === "connecting"
          ? "bg-warning/15 text-warning"
          : "bg-danger/15 text-danger"
      }`}
    >
      {status === "connecting" ? t("connection.reconnecting") : t("connection.disconnected")}
    </div>
  );
}
