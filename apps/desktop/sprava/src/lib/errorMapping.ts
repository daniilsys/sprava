import i18next from "i18next";

export function translateError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const key = `errors:${(error as { code: string }).code}`;
    if (i18next.exists(key)) return i18next.t(key);
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }
  return i18next.t("errors:UNKNOWN");
}
