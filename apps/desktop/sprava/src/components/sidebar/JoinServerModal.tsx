import { useState, FormEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";
import { useAppStore } from "../../store/app.store";
import { useUIStore } from "../../store/ui.store";
import { requestCaptcha } from "../ui/CaptchaModal";
import type { Server } from "../../types/models";

interface ServerPreview {
  name: string;
  icon: string | null;
  description: string | null;
  memberCount: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function JoinServerModal({ open, onClose }: Props) {
  const { t } = useTranslation("server");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ServerPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch preview when code changes
  useEffect(() => {
    if (!code.trim() || code.trim().length < 3) {
      setPreview(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const result = (await api.servers.preview(code.trim())) as ServerPreview;
        setPreview(result);
        setError("");
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [code]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError("");

    const captchaToken = await requestCaptcha();
    if (!captchaToken) return;

    setLoading(true);
    try {
      const server = (await api.servers.join(code.trim(), { "h-captcha-response": captchaToken })) as Server;
      useAppStore.getState().addServer(server);
      useUIStore.getState().navigateToServer(server.id);
      setCode("");
      setPreview(null);
      onClose();
    } catch (err: unknown) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("join.title")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Input
          placeholder={t("join.codePlaceholder")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoFocus
        />

        {/* Server preview card */}
        {previewLoading && (
          <div className="flex justify-center py-3">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
        {preview && !previewLoading && (
          <div className="flex items-center gap-3 p-3 bg-elevated rounded-lg border border-border-subtle animate-fade-slide-up">
            {preview.icon && !iconFailed ? (
              <img src={preview.icon} alt={preview.name} className="w-10 h-10 rounded-xl object-cover" onError={() => setIconFailed(true)} />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-elevated-2 flex items-center justify-center font-display font-bold text-sm text-text-secondary">
                {preview.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">{preview.name}</p>
              {preview.description && (
                <p className="text-xs text-text-muted truncate">{preview.description}</p>
              )}
              <p className="text-xs text-text-muted mt-0.5">{t("join.member", { count: preview.memberCount })}</p>
            </div>
          </div>
        )}

        <div className="flex justify-between gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            {t("common:cancel")}
          </Button>
          <Button type="submit" loading={loading}>
            {t("join.submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
