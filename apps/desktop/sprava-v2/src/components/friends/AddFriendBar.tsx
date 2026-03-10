import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useFriendsStore } from "../../store/friends.store";
import { translateError } from "../../lib/errorMapping";

export function AddFriendBar() {
  const { t } = useTranslation("friends");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSend = async () => {
    const u = username.trim();
    if (!u) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      await useFriendsStore.getState().sendRequest(u);
      setUsername("");
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: any) {
      const msg = e?.message || "";
      setErrorMsg(msg.includes("USER_NOT_FOUND") ? t("add.userNotFound") : translateError(e));
      setStatus("error");
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-text-primary mb-1">{t("add.title")}</h3>
      <p className="text-xs text-text-muted mb-3">
        {t("add.description")}
      </p>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={t("add.placeholder")}
            error={status === "error" ? errorMsg : undefined}
          />
        </div>
        <Button
          onClick={handleSend}
          loading={status === "sending"}
          disabled={!username.trim()}
          size="md"
        >
          {t("add.submit")}
        </Button>
      </div>

      {status === "sent" && (
        <p className="text-xs text-live mt-2">{t("add.success")}</p>
      )}
    </div>
  );
}
