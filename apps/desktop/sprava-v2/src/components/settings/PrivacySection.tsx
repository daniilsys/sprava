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

  return (
    <div className="max-w-xl space-y-1">
      <p className="text-sm text-text-secondary mb-6">
        {t("privacy.description")}
      </p>

      {privacyFieldDefs.map((field) => (
        <div key={field.key} className="py-4 border-b border-border-subtle last:border-0">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{t(field.labelKey)}</p>
              <p className="text-xs text-text-muted mt-0.5">{t(field.descKey)}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {field.options.map((opt) => {
                const isActive = settings[field.key] === opt;
                const label = field.key === "dmPrivacy"
                  ? t(`privacy.dm.${opt}`)
                  : t(`privacy.level.${opt}`);
                return (
                  <button
                    key={opt}
                    onClick={() => setSettings({ ...settings, [field.key]: opt })}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-elevated border border-border text-text-muted hover:text-text-secondary hover:bg-elevated-2"
                    }`}
                  >
                    {label}
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
            {t("privacy.saved")}
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
