import { z } from "zod";

export const MessageType = z.enum(["TEXT", "SYSTEM"]);

export const editMessageSchema = z.object({
  content: z.string().optional(),
});

const attachmentItemSchema = z.object({
  url: z.string().url(),
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mimeType: z.string().min(1),
});

export const replyMessageSchema = z
  .object({
    content: z.string().max(2000).optional(),
    attachments: z.array(attachmentItemSchema).max(10).optional(),
  })
  .refine(
    (d) =>
      (d.content && d.content.length > 0) ||
      (d.attachments && d.attachments.length > 0),
    { message: "Reply must have content or at least one attachment" },
  );

export type EditMessageDto = z.infer<typeof editMessageSchema>;
export type ReplyMessageDto = z.infer<typeof replyMessageSchema>;
