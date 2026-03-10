import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 31 chars, no I/O/0/1
const CODE_LENGTH = 7;

export function generateInviteCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
