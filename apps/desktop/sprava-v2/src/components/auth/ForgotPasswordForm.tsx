import { useState, useRef, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";

interface ForgotPasswordFormProps {
  onSwitchToLogin: () => void;
}

export function ForgotPasswordForm({
  onSwitchToLogin,
}: ForgotPasswordFormProps) {
  const { t } = useTranslation("auth");
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      setError(t("forgot.captchaRequired"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.auth.forgotPassword({ email, "h-captcha-response": captchaToken });
      setSent(true);
    } catch (err: unknown) {
      setError(translateError(err));
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-xl font-display font-bold">{t("forgot.sent.title")}</h2>
        <p className="text-sm text-text-secondary">
          {t("forgot.sent.message", { email })}
        </p>
        <Button variant="secondary" onClick={onSwitchToLogin}>
          {t("forgot.backToLogin")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl font-display font-bold text-center">
        {t("forgot.title")}
      </h2>
      <p className="text-sm text-text-secondary text-center">
        {t("forgot.subtitle")}
      </p>

      {error && (
        <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Input
        type="email"
        placeholder={t("login.emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <div className="flex justify-center">
        <HCaptcha
          sitekey={
            import.meta.env.VITE_HCAPTCHA_SITEKEY ||
            "10000000-ffff-ffff-ffff-000000000001"
          }
          theme="dark"
          onVerify={setCaptchaToken}
          ref={captchaRef}
        />
      </div>

      <Button type="submit" loading={loading} className="w-full">
        {t("forgot.submit")}
      </Button>

      <button
        type="button"
        onClick={onSwitchToLogin}
        className="text-sm text-text-secondary hover:text-text-primary transition-colors text-center"
      >
        {t("forgot.backToLogin")}
      </button>
    </form>
  );
}
