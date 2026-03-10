import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";
import { uploadServerIcon } from "../../lib/upload";
import { useAppStore } from "../../store/app.store";
import type { Server } from "../../types/models";

interface ServerOverviewProps {
  server: Server;
}

function getInitials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ServerOverview({ server }: ServerOverviewProps) {
  const { t } = useTranslation(["server", "common"]);
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description || "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [pendingIconFile, setPendingIconFile] = useState<File | null>(null);
  const [pendingIconRemove, setPendingIconRemove] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // What to display as the current icon
  const displayIcon = (() => {
    if (pendingIconRemove) return null;
    if (iconPreview) return iconPreview;
    return server.icon;
  })();

  // Clean up blob URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (iconPreview?.startsWith("blob:")) URL.revokeObjectURL(iconPreview);
    };
  }, [iconPreview]);

  const MAX_ICON_SIZE = 4 * 1024 * 1024; // 4 MB
  const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t("server:overview.iconTypeError"));
      return;
    }
    if (file.size > MAX_ICON_SIZE) {
      setError(t("server:overview.iconSizeError", { size: (file.size / 1024 / 1024).toFixed(1) }));
      return;
    }

    if (iconPreview?.startsWith("blob:")) URL.revokeObjectURL(iconPreview);
    setIconPreview(URL.createObjectURL(file));
    setIconFailed(false);
    setPendingIconFile(file);
    setPendingIconRemove(false);
    setError("");
  };

  const handleCancelIcon = () => {
    if (iconPreview?.startsWith("blob:")) URL.revokeObjectURL(iconPreview);
    setIconPreview(null);
    setPendingIconFile(null);
    setPendingIconRemove(false);
  };

  const handleRemoveIcon = () => {
    if (iconPreview?.startsWith("blob:")) URL.revokeObjectURL(iconPreview);
    setIconPreview(null);
    setPendingIconFile(null);
    setPendingIconRemove(true);
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      let iconUrl: string | null | undefined = undefined;

      // Upload new icon if pending
      if (pendingIconFile) {
        iconUrl = await uploadServerIcon(pendingIconFile, server.id);
        setPendingIconFile(null);
        setIconPreview(null);
      } else if (pendingIconRemove) {
        iconUrl = null;
        setPendingIconRemove(false);
      }

      const updateData: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
      };
      if (iconUrl !== undefined) {
        updateData.icon = iconUrl;
      }

      const updated = (await api.servers.update(server.id, updateData)) as Server;
      useAppStore.getState().addServer({ ...server, ...updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setLoading(false);
    }
  };

  const hasFieldChanges = name.trim() !== server.name || (description.trim() || "") !== (server.description || "");
  const hasIconChange = !!pendingIconFile || pendingIconRemove;
  const hasChanges = hasFieldChanges || hasIconChange;

  return (
    <div className="max-w-xl space-y-8">
      {/* Server Icon */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-3 uppercase tracking-wider">
          {t("server:overview.serverIcon")}
        </label>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative group w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-border-subtle hover:border-primary/50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {displayIcon && !iconFailed ? (
              <img
                src={displayIcon}
                alt={server.name}
                className="w-full h-full object-cover"
                onError={() => setIconFailed(true)}
              />
            ) : (
              <div className="w-full h-full bg-elevated-2 flex items-center justify-center">
                <span className="text-xl font-semibold text-text-secondary">
                  {getInitials(name || server.name)}
                </span>
              </div>
            )}

            {/* Pending indicator */}
            {hasIconChange && (
              <div className="absolute inset-0 rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-surface pointer-events-none" />
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-center gap-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-[10px] font-medium text-white/90 mt-0.5">{t("server:overview.upload")}</span>
            </div>
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleIconSelect}
          />

          <div className="flex flex-col gap-2">
            {hasIconChange ? (
              <button
                onClick={handleCancelIcon}
                className="text-xs text-danger hover:text-danger-hover transition-colors self-start"
              >
                {t("server:overview.cancelChange")}
              </button>
            ) : (
              <>
                <p className="text-xs text-text-muted leading-relaxed">
                  {t("server:overview.iconHint")}<br />
                  {t("server:overview.iconHintFormats")}
                </p>
                {server.icon && (
                  <button
                    onClick={handleRemoveIcon}
                    className="text-xs text-danger hover:text-danger-hover transition-colors self-start"
                  >
                    {t("server:overview.removeIcon")}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-border-subtle" />

      {/* Server Name */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
          {t("server:overview.serverName")}
        </label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
          {t("server:overview.description")}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none h-24 focus:border-primary transition-colors duration-150"
          placeholder={t("server:overview.descriptionPlaceholder")}
          maxLength={500}
        />
        <p className="text-[11px] text-text-muted mt-1 text-right">
          {description.length}/500
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {saved && (
          <span className="text-sm text-live font-medium animate-in fade-in duration-150">
            {t("server:overview.changesSaved")}
          </span>
        )}
        <Button
          onClick={handleSave}
          loading={loading}
          disabled={!hasChanges}
          variant={saved ? "success" : "primary"}
        >
          {saved ? t("common:saved") : t("common:saveChanges")}
        </Button>
      </div>
    </div>
  );
}
