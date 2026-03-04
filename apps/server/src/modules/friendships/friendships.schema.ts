import { z } from "zod";

export const updateFriendshipSchema = z.object({
  status: z.enum(["ACCEPTED", "BLOCKED"]),
  receiverId: z.string(),
});

export type UpdateFriendshipDto = z.infer<typeof updateFriendshipSchema>;
