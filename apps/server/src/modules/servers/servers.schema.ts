import { z } from "zod";

export const createServerSchema = z.object({
  name: z.string().min(3).max(50),
  icon: z.url().optional(),
  description: z.string().max(500).optional(),
});

export const updateServerSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  icon: z.url().optional(),
  description: z.string().max(500).optional(),
});

export type CreateServerDto = z.infer<typeof createServerSchema>;
export type UpdateServerDto = z.infer<typeof updateServerSchema>;
