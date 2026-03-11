import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";

interface Settings {
  showLocation: string;
  showActivity: string;
  showStatus: string;
  showEmail: string;
  showWebsite: string;
  dmPrivacy: string;
}

const privacyLevels = ["PUBLIC", "FRIENDS_ONLY", "NOBODY"] as const;
const dmOptions = ["COMMON_SERVER", "FRIENDS_ONLY"] as const;

const privacyFieldDefs: { key: keyof Settings; labelKey: string; descKey: string; options: readonly string[] }[] = [
  { key: "showStatus", labelKey: "privacy.showStatus", descKey: "privacy.showStatusDesc", options: privacyLevels },
  { key: "showActivity", labelKey: "privacy.showActivity", descKey: "privacy.showActivityDesc", options: privacyLevels },
  { key: "showLocation", labelKey: "privacy.showLocation", descKey: "privacy.showLocationDesc", options: privacyLevels },
  { key: "showEmail", labelKey: "privacy.showEmail", descKey: "privacy.showEmailDesc", options: privacyLevels },
  { key: "showWebsite", labelKey: "privacy.showWebsite", descKey: "privacy.showWebsiteDesc", options: privacyLevels },
  { key: "dmPrivacy", labelKey: "privacy.dmPrivacy", descKey: "privacy.dmPrivacyDesc", options: dmOptions },
];

export function PrivacySection() {
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

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.settings.update({
        showLocation: settings.showLocation,
        showActivity: settings.showActivity,
        showStatus: settings.showStatus,
        showEmail: settings.showEmail,
        showWebsite: settings.showWebsite,
        dmPrivacy: settings.dmPrivacy,
      });
      setInitial({ ...settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = settings && initial && (
    settings.showLocation !== initial.showLocation ||
    settings.showActivity !== initial.showActivity ||
    settings.showStatus !== initial.showStatus ||
    settings.showEmail !== initial.showEmail ||
    settings.showWebsite !== initial.showWebsite ||
    settings.dmPrivacy !== initial.dmPrivacy
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!settings) {
    return <p className="text-sm text-text-muted">{t("privacy.loadFailed")}</p>;
  }

  const fieldIcons: Record<string, React.ReactNode> = {
    showStatus: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" fill="var(--color-primary)" stroke="none" />
      </svg>
    ),
    showActivity: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    showLocation: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    showEmail: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 7l-10 6L2 7" />
      </svg>
    ),
    showWebsite: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    dmPrivacy: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  };

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-text-secondary">
        {t("privacy.description")}
      </p>

      <div className="rounded-xl border border-border-subtle bg-elevated/50 overflow-hidden">
        {privacyFieldDefs.map((field, i) => {
          const label = (opt: string) =>
            field.key === "dmPrivacy" ? t(`privacy.dm.${opt}`) : t(`privacy.level.${opt}`);
          return (
            <div key={field.key}>
              {i > 0 && <div className="mx-5 border-t border-border-subtle" />}
              <div className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                    {fieldIcons[field.key]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
                      {t(field.labelKey)}
                    </p>
                    <p className="text-xs text-text-muted/70">{t(field.descKey)}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {field.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setSettings({ ...settings, [field.key]: opt })}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                          settings[field.key] === opt
                            ? "bg-primary/15 text-primary border border-primary/25"
                            : "bg-surface border border-border-subtle text-text-muted hover:text-text-secondary hover:border-border"
                        }`}
                      >
                        {label(opt)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
            {t("privacy.saved")}
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
