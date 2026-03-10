import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "../ui/IconButton";

interface AttachmentUploadProps {
  onFileSelected: (file: File) => void;
  uploading: boolean;
}

export function AttachmentUpload({ onFileSelected, uploading }: AttachmentUploadProps) {
  const { t } = useTranslation("chat");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      // Reset input so same file can be picked again
      e.target.value = "";
    }
  };

  return (
    <>
      <IconButton
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title={t("input.attachFile")}
      >
        {uploading ? (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        )}
      </IconButton>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
}
