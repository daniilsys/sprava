import { useTranslation } from "react-i18next";
import { useUpdater } from "../../hooks/useUpdater";

export function UpdateBanner() {
  const { t } = useTranslation("common");
  const { available, version, downloading, progress, error, install, dismiss } = useUpdater();

  if (!available) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-b border-primary/20 animate-fade-slide-down">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>

      <span className="text-sm text-text-primary flex-1">
        {downloading
          ? t("update.downloading", { progress })
          : t("update.available", { version })}
      </span>

      {error && <span className="text-xs text-danger">{error}</span>}

      {downloading ? (
        <div className="w-24 h-1.5 bg-elevated-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={install}
            className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
          >
            {t("update.install")}
          </button>
          <button
            onClick={dismiss}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
