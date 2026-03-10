import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";

interface ResetPasswordFormProps {
  token: string;
  onSwitchToLogin: () => void;
}

export function ResetPasswordForm({
  token,
  onSwitchToLogin,
}: ResetPasswordFormProps) {
  const { t } = useTranslation("auth");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.auth.resetPassword({ token, password });
      setSuccess(true);
    } catch (err: unknown) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-xl font-display font-bold">{t("reset.success.title")}</h2>
        <p className="text-sm text-text-secondary">
          {t("reset.success.message")}
        </p>
        <Button onClick={onSwitchToLogin}>{t("login.submit")}</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl font-display font-bold text-center">
        {t("reset.title")}
      </h2>

      {error && (
        <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Input
        type="password"
        placeholder={t("reset.placeholder")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
      />

      <Button type="submit" loading={loading} className="w-full">
        {t("reset.submit")}
      </Button>
    </form>
  );
}
