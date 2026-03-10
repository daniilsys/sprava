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
  const { t } = useTranslation("auth");
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
      await register(username, email, password, captchaToken);
    } catch (err: unknown) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl font-display font-bold text-center">
        {t("register.title")}
      </h2>

      {error && (
        <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Input
        placeholder={t("register.usernamePlaceholder")}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <Input
        type="email"
        placeholder={t("register.emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder={t("register.passwordPlaceholder")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
      />

      <Button type="submit" loading={loading} className="w-full">
        {t("register.submit")}
      </Button>

      <p className="text-sm text-center text-text-secondary">
        {t("register.hasAccount")}{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-primary hover:text-primary-hover transition-colors"
        >
          {t("register.signIn")}
        </button>
      </p>
    </form>
  );
}
