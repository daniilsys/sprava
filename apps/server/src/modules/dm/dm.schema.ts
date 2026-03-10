import { z } from "zod";

export const createDmSchema = z.object({
  participantIds: z.array(z.string()).min(2).max(10),
});

export const updateDmSchema = z.object({
  name: z.string().optional(),
  icon: z.string().optional(),
});

const attachmentItemSchema = z.object({
  url: z.string().url(),
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mimeType: z.string().min(1),
});

export const sendMessageSchema = z
  .object({
    content: z.string().max(2000).optional(),
    attachments: z.array(attachmentItemSchema).max(10).optional(),
    replyToId: z.string().optional(),
  })
  .refine(
    (d) =>
      (d.content && d.content.length > 0) ||
      (d.attachments && d.attachments.length > 0),
    { message: "Message must have content or at least one attachment" },
  );

export type CreateDmDto = z.infer<typeof createDmSchema>;
export type UpdateDmDto = z.infer<typeof updateDmSchema>;
export type SendMessageDto = z.infer<typeof sendMessageSchema>;

export const markReadSchema = z.object({
  lastReadMessageId: z.string().min(1),
});

export type MarkReadDto = z.infer<typeof markReadSchema>;
