import { z } from "zod";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const ATTACHMENT_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // Audio
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  // Archives
  "application/zip",
  "application/x-tar",
  "application/gzip",
] as const;

const MB = 1024 * 1024;

export const avatarPresignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(AVATAR_TYPES),
  size: z
    .number()
    .int()
    .positive()
    .max(4 * MB, "Avatar must be under 4MB"),
});

export const attachmentPresignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ATTACHMENT_TYPES),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * MB, "Attachment must be under 10MB"),
});

export const serverIconPresignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(AVATAR_TYPES),
  size: z
    .number()
    .int()
    .positive()
    .max(4 * MB, "Server icon must be under 4MB"),
  serverId: z.string().min(1),
});

export const groupIconPresignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(AVATAR_TYPES),
  size: z
    .number()
    .int()
    .positive()
    .max(4 * MB, "Group icon must be under 4MB"),
  dmId: z.string().min(1),
});

export type AvatarPresignDto = z.infer<typeof avatarPresignSchema>;
export type AttachmentPresignDto = z.infer<typeof attachmentPresignSchema>;
export type ServerIconPresignDto = z.infer<typeof serverIconPresignSchema>;
export type GroupIconPresignDto = z.infer<typeof groupIconPresignSchema>;
