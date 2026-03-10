import { z } from "zod";

const privacyLevel = z.enum(["PUBLIC", "FRIENDS_ONLY", "NOBODY"]);

export const updateSettingsSchema = z
  .object({
    theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
    language: z.enum(["en", "fr"]).optional(),
    showLocation: privacyLevel.optional(),
    showActivity: privacyLevel.optional(),
    showStatus: privacyLevel.optional(),
    showEmail: privacyLevel.optional(),
    showWebsite: privacyLevel.optional(),
    dmPrivacy: z.enum(["COMMON_SERVER", "FRIENDS_ONLY"]).optional(),
    noiseCancellation: z.enum(["OFF", "LIGHT", "HIGH_QUALITY"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
