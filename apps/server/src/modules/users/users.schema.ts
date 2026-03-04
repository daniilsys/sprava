import { z } from "zod";

export const updateAccountSchema = z.object({
  username: z.string().min(3).max(16).optional(),
  avatar: z.url().optional(),
});

export const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  website: z.url().optional(),
});

export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
