import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
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

const INVITE_RE = /(?:https?:\/\/)?sprava\.top\/([A-Za-z0-9]+)/;

export function extractInviteCode(content: string): string | null {
  const match = content.match(INVITE_RE);
  return match ? match[1] : null;
}

interface InviteEmbedProps {
  inviteCode: string;
}

export function InviteEmbed({ inviteCode }: InviteEmbedProps) {
  const { t } = useTranslation("chat");
  const [preview, setPreview] = useState<ServerPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  const alreadyMember = useAppStore((s) => {
    for (const server of s.servers.values()) {
      if (server.inviteCode === inviteCode) return server.id;
    }
    return null;
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api.servers
      .preview(inviteCode)
      .then((result) => {
        if (!cancelled) setPreview(result as ServerPreview);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [inviteCode]);

  const handleJoin = async () => {
    const captchaToken = await requestCaptcha();
    if (!captchaToken) return;
    setJoining(true);
    try {
      const server = (await api.servers.join(inviteCode, { "h-captcha-response": captchaToken })) as Server;
      useAppStore.getState().addServer(server);
      useUIStore.getState().navigateToServer(server.id);
    } catch {
      // ignore
    } finally {
      setJoining(false);
    }
  };

  const handleNavigate = () => {
    if (alreadyMember) {
      useUIStore.getState().navigateToServer(alreadyMember);
    }
  };

  if (loading) {
    return (
      <div className="mt-2 w-80 rounded-lg border border-border-subtle bg-elevated p-4">
        <div className="flex justify-center py-2">
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="mt-2 w-80 rounded-lg border border-border-subtle bg-elevated p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-elevated-2 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-secondary">{t("invite.invalid")}</p>
            <p className="text-xs text-text-muted">{t("invite.invalidMessage")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 w-80 rounded-lg border border-border-subtle bg-elevated overflow-hidden">
      <div className="p-3.5">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2.5">
          {t("invite.title")}
        </p>
        <div className="flex items-center gap-3">
          {preview.icon && !iconFailed ? (
            <img
              src={preview.icon}
              alt={preview.name}
              className="w-11 h-11 rounded-xl object-cover flex-shrink-0"
              onError={() => setIconFailed(true)}
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-elevated-2 flex items-center justify-center font-display font-bold text-sm text-text-secondary flex-shrink-0">
              {preview.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary truncate">{preview.name}</p>
            <p className="text-xs text-text-muted mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 align-middle" />
              {t("invite.member", { count: preview.memberCount })}
            </p>
          </div>
          {alreadyMember ? (
            <button
              onClick={handleNavigate}
              className="px-3.5 py-1.5 rounded-lg bg-elevated-2 text-xs font-medium text-text-secondary hover:bg-elevated-2/80 transition-colors flex-shrink-0"
            >
              {t("invite.joined")}
            </button>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="px-3.5 py-1.5 rounded-lg bg-green-600 text-xs font-medium text-white hover:bg-green-700 transition-colors flex-shrink-0 disabled:opacity-50"
            >
              {joining ? "..." : t("invite.join")}
            </button>
          )}
        </div>
        {preview.description && (
          <p className="text-xs text-text-muted mt-2.5 line-clamp-2">{preview.description}</p>
        )}
      </div>
    </div>
  );
}
