import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description: string;
  loading?: boolean;
}

export function ReasonModal({ open, onClose, onConfirm, title, description, loading }: ReasonModalProps) {
  const { t } = useTranslation("common");
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason.trim());
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      <p className="text-sm text-text-secondary mb-4">{description}</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("reason.placeholder")}
        rows={3}
        className="w-full rounded-lg bg-elevated border border-border-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex justify-between gap-3 mt-4">
        <Button variant="secondary" size="sm" onClick={handleClose} disabled={loading}>
          {t("cancel")}
        </Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} loading={loading} className="!bg-danger hover:!bg-danger/80">
          {title}
        </Button>
      </div>
    </Modal>
  );
}
