import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useAuthStore } from "../../store/auth.store";
import { requestCaptcha } from "../ui/CaptchaModal";
import { translateError } from "../../lib/errorMapping";

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { t, i18n } = useTranslation("auth");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const captchaToken = await requestCaptcha();
    if (!captchaToken) return;

    setLoading(true);
    try {
      await register(username, email, password, captchaToken, i18n.language);
    } catch (err: unknown) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-display font-bold text-text-primary">
          {t("register.title")}
        </h2>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/8 rounded-lg px-3 py-2.5 border border-danger/10 animate-fade-slide-up">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 ml-0.5">
            {t("register.usernamePlaceholder")}
          </label>
          <Input
            placeholder="coolname"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            prefix={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 ml-0.5">
            {t("register.emailPlaceholder")}
          </label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            prefix={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 6L2 7" />
              </svg>
            }
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 ml-0.5">
            {t("register.passwordPlaceholder")}
          </label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            prefix={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            }
          />
          <p className="text-[11px] text-text-muted mt-1 ml-0.5">8 characters minimum</p>
        </div>
      </div>

      <Button type="submit" loading={loading} className="w-full !py-2.5">
        {t("register.submit")}
      </Button>

      <p className="text-[13px] text-center text-text-muted">
        {t("register.hasAccount")}{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-primary hover:text-primary-hover transition-colors font-medium"
        >
          {t("register.signIn")}
        </button>
      </p>
    </form>
  );
}
