import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";
import { useAppStore } from "../../store/app.store";
import { useUIStore } from "../../store/ui.store";
import type { Server } from "../../types/models";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateServerModal({ open, onClose }: Props) {
  const { t } = useTranslation("server");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const server = (await api.servers.create({ name: name.trim() })) as Server;
      useAppStore.getState().addServer(server);
      useUIStore.getState().navigateToServer(server.id);
      setName("");
      onClose();
    } catch (err: unknown) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("create.title")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Input
          placeholder={t("create.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <div className="flex justify-between gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            {t("common:cancel")}
          </Button>
          <Button type="submit" loading={loading}>
            {t("create.submit")}
          </Button>
        </div>
      </form>
      <div className="mt-4 pt-4 border-t border-border-subtle text-center">
        <p className="text-sm text-text-secondary mb-2">{t("create.hasInvite")}</p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            onClose();
            useUIStore.getState().openModal("joinServer");
          }}
        >
          {t("create.joinServer")}
        </Button>
      </div>
    </Modal>
  );
}
