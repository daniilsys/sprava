import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";

export function VerifyEmailNotice() {
  const { t } = useTranslation("auth");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    setLoading(true);
    try {
      await api.auth.resendVerification();
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h2 className="text-xl font-display font-bold">{t("verify.title")}</h2>
      <p className="text-sm text-text-secondary">
        {t("verify.message")}
      </p>
      {sent ? (
        <p className="text-sm text-live">{t("verify.resent")}</p>
      ) : (
        <Button variant="secondary" onClick={resend} loading={loading}>
          {t("verify.resend")}
        </Button>
      )}
    </div>
  );
}
