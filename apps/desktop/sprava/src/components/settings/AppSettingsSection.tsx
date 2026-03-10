import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";
import { useUIStore } from "../../store/ui.store";

interface Settings {
  theme: string;
  language: string;
  noiseCancellation: string;
}

const settingGroupDefs: {
  key: keyof Settings;
  labelKey: string;
  descKey: string;
  options: { value: string; labelKey?: string; staticLabel?: string }[];
}[] = [
  {
    key: "theme",
    labelKey: "app.theme",
    descKey: "app.themeDesc",
    options: [
      { value: "DARK", labelKey: "app.theme.DARK" },
      { value: "LIGHT", labelKey: "app.theme.LIGHT" },
      { value: "SYSTEM", labelKey: "app.theme.SYSTEM" },
    ],
  },
  {
    key: "language",
    labelKey: "app.language",
    descKey: "app.languageDesc",
    options: [
      { value: "en", staticLabel: "English" },
      { value: "fr", staticLabel: "Fran\u00e7ais" },
    ],
  },
  {
    key: "noiseCancellation",
    labelKey: "app.noiseCancellation",
    descKey: "app.noiseCancellationDesc",
    options: [
      { value: "OFF", labelKey: "app.noiseCancellation.OFF" },
      { value: "LIGHT", labelKey: "app.noiseCancellation.LIGHT" },
      { value: "HIGH_QUALITY", labelKey: "app.noiseCancellation.HIGH_QUALITY" },
    ],
  },
];

export function AppSettingsSection() {
  const { t } = useTranslation("settings");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [initial, setInitial] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = (await api.settings.get()) as Settings;
      setSettings(s);
      setInitial(s);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Apply theme to HTML element when settings change
  useEffect(() => {
    if (!settings) return;
    const html = document.documentElement;
    html.classList.remove("theme-light", "theme-dark");
    if (settings.theme === "LIGHT") {
      html.classList.add("theme-light");
    } else if (settings.theme === "DARK") {
      html.classList.add("theme-dark");
    }
    // SYSTEM = no class, let @media query handle it
  }, [settings?.theme]);

  useEffect(() => {
    if (settings?.language) {
      i18next.changeLanguage(settings.language);
    }
  }, [settings?.language]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.settings.update(settings as unknown as Record<string, unknown>);
      setInitial({ ...settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setSaving(false);
    }
  };

  const fontSize = useUIStore((s) => s.fontSize);

  const hasChanges = settings && initial && (
    settings.theme !== initial.theme ||
    settings.language !== initial.language ||
    settings.noiseCancellation !== initial.noiseCancellation
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!settings) {
    return <p className="text-sm text-text-muted">{t("app.loadFailed")}</p>;
  }

  return (
    <div className="max-w-xl space-y-1">
      {/* Font size (client-only) */}
      <div className="py-4 border-b border-border-subtle">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">{t("app.fontSize")}</p>
            <p className="text-xs text-text-muted mt-0.5">{t("app.fontSizeDesc")}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {(["small", "medium", "large"] as const).map((size) => (
              <button
                key={size}
                onClick={() => useUIStore.getState().setFontSize(size)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                  fontSize === size
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-elevated border border-border text-text-muted hover:text-text-secondary hover:bg-elevated-2"
                }`}
              >
                {t(`app.fontSize.${size}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {settingGroupDefs.map((group) => (
        <div key={group.key} className="py-4 border-b border-border-subtle last:border-0">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{t(group.labelKey)}</p>
              <p className="text-xs text-text-muted mt-0.5">{t(group.descKey)}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {group.options.map((opt) => {
                const isActive = settings[group.key] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSettings({ ...settings, [group.key]: opt.value })}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-elevated border border-border text-text-muted hover:text-text-secondary hover:bg-elevated-2"
                    }`}
                  >
                    {opt.staticLabel ?? t(opt.labelKey!)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* Error */}
      {error && <p className="text-sm text-danger pt-2">{error}</p>}

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-4">
        {saved && (
          <span className="text-sm text-live font-medium animate-in fade-in duration-150">
            {t("app.settingsSaved")}
          </span>
        )}
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges}
          variant={saved ? "success" : "primary"}
        >
          {saved ? t("common:saved") : t("common:saveChanges")}
        </Button>
      </div>
    </div>
  );
}
