import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useAuthStore } from "../../store/auth.store";
import { requestCaptcha } from "../ui/CaptchaModal";
import { translateError } from "../../lib/errorMapping";

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSwitchToForgot: () => void;
}

export function LoginForm({
  onSwitchToRegister,
  onSwitchToForgot,
}: LoginFormProps) {
  const { t } = useTranslation("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const captchaToken = await requestCaptcha();
    if (!captchaToken) return;

    setLoading(true);
    try {
      await login(email, password, captchaToken);
    } catch (err: unknown) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl font-display font-bold text-center">
        {t("login.title")}
      </h2>
      <p className="text-sm text-text-secondary text-center">
        {t("login.subtitle")}
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
      <Input
        type="password"
        placeholder={t("login.passwordPlaceholder")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <Button type="submit" loading={loading} className="w-full">
        {t("login.submit")}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onSwitchToForgot}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          {t("login.forgotPassword")}
        </button>
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-primary hover:text-primary-hover transition-colors"
        >
          {t("login.createAccount")}
        </button>
      </div>
    </form>
  );
}
