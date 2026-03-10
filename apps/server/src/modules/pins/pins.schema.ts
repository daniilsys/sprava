import { z } from "zod";

export const pinMessageSchema = z.object({
  messageId: z.string().min(1),
});

export const unpinMessageSchema = z.object({
  messageId: z.string().min(1),
});

export type PinMessageDto = z.infer<typeof pinMessageSchema>;
export type UnpinMessageDto = z.infer<typeof unpinMessageSchema>;
