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

  const settingIcons: Record<string, React.ReactNode> = {
    fontSize: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
    theme: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
    language: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    noiseCancellation: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  };

  const allRows = [
    {
      key: "fontSize" as const,
      labelKey: "app.fontSize",
      descKey: "app.fontSizeDesc",
      options: (["small", "medium", "large"] as const).map((s) => ({
        value: s,
        label: t(`app.fontSize.${s}`),
      })),
      activeValue: fontSize,
      onChange: (v: string) => useUIStore.getState().setFontSize(v as "small" | "medium" | "large"),
    },
    ...settingGroupDefs.map((g) => ({
      key: g.key,
      labelKey: g.labelKey,
      descKey: g.descKey,
      options: g.options.map((o) => ({
        value: o.value,
        label: o.staticLabel ?? t(o.labelKey!),
      })),
      activeValue: settings[g.key],
      onChange: (v: string) => setSettings({ ...settings, [g.key]: v }),
    })),
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border border-border-subtle bg-elevated/50 overflow-hidden">
        {allRows.map((row, i) => (
          <div key={row.key}>
            {i > 0 && <div className="mx-5 border-t border-border-subtle" />}
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                  {settingIcons[row.key]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
                    {t(row.labelKey)}
                  </p>
                  <p className="text-xs text-text-muted/70">{t(row.descKey)}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {row.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => row.onChange(opt.value)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                        row.activeValue === opt.value
                          ? "bg-primary/15 text-primary border border-primary/25"
                          : "bg-surface border border-border-subtle text-text-muted hover:text-text-secondary hover:border-border"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-danger bg-danger/8 rounded-lg px-3 py-2.5 border border-danger/10">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-xs text-live font-medium">
            {t("app.settingsSaved")}
          </span>
        )}
        <Button
          size="sm"
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges}
        >
          {saved ? t("common:saved") : t("common:saveChanges")}
        </Button>
      </div>
    </div>
  );
}
