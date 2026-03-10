import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";
import { useAppStore } from "../../store/app.store";
import type { Channel } from "../../types/models";

interface CreateChannelModalProps {
  open: boolean;
  onClose: () => void;
  serverId: string;
  parentId?: string | null;
}

const channelTypes = [
  { value: "TEXT", labelKey: "createChannel.type.TEXT", icon: "#" },
  { value: "VOICE", labelKey: "createChannel.type.VOICE", icon: "V" },
  { value: "PARENT", labelKey: "createChannel.type.PARENT", icon: "▾" },
] as const;

export function CreateChannelModal({ open, onClose, serverId, parentId }: CreateChannelModalProps) {
  const { t } = useTranslation(["server", "common"]);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("TEXT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const channel = (await api.channels.create({ name: trimmed, type, serverId, parentId: parentId || undefined })) as Channel;
      useAppStore.getState().addChannel(channel);
      setName("");
      setType("TEXT");
      onClose();
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("server:createChannel.title")}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1 uppercase tracking-wider">
            {t("server:createChannel.typeLabel")}
          </label>
          <div className="flex gap-2">
            {channelTypes.filter((ct) => !parentId || ct.value !== "PARENT").map((ct) => (
              <button
                key={ct.value}
                onClick={() => setType(ct.value)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  type === ct.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-elevated text-text-secondary hover:bg-elevated-2"
                }`}
              >
                <span className="mr-1.5">{ct.icon}</span>
                {t(`server:${ct.labelKey}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1 uppercase tracking-wider">
            {t("server:createChannel.nameLabel")}
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder={t("server:createChannel.namePlaceholder")}
            error={error}
          />
        </div>
        <div className="flex justify-between gap-2">
          <Button variant="secondary" onClick={onClose}>{t("common:cancel")}</Button>
          <Button onClick={handleCreate} loading={loading} disabled={!name.trim()}>
            {t("server:createChannel.submit")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
