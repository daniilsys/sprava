import { z } from "zod";
import { Permission } from "@sprava/shared";

const ALL_PERMISSIONS = Object.values(Permission).reduce(
  (acc, p) => acc | p,
  0n,
);

const permissionBitfield = z
  .string()
  .regex(/^\d+$/, "Must be a non-negative integer string")
  .refine(
    (val) => {
      const bits = BigInt(val);
      return (bits & ~ALL_PERMISSIONS) === 0n;
    },
    { message: "Contains unknown permission bits" },
  );

export const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["TEXT", "VOICE", "PARENT", "ANNOUNCEMENT"]),
  serverId: z.string(),
  parentId: z.string().optional(),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["TEXT", "VOICE", "PARENT", "ANNOUNCEMENT"]).optional(),
  position: z.number().optional(),
  parentId: z.string().nullable().optional(),
  syncParentRules: z.boolean().optional(),
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

const ruleTarget = z
  .object({
    roleId: z.string().optional(),
    memberId: z.string().optional(),
  })
  .refine((d) => Boolean(d.roleId) !== Boolean(d.memberId), {
    message: "Exactly one of roleId or memberId must be provided",
  });

export const channelRuleSchema = ruleTarget.and(
  z.object({
    allow: permissionBitfield.default("0"),
    deny: permissionBitfield.default("0"),
  }),
);

export const deleteChannelRuleSchema = ruleTarget;

export type CreateChannelDto = z.infer<typeof createChannelSchema>;
export type UpdateChannelDto = z.infer<typeof updateChannelSchema>;
export type SendMessageDto = z.infer<typeof sendMessageSchema>;
export type ChannelRuleDto = z.infer<typeof channelRuleSchema>;
export type DeleteChannelRuleDto = z.infer<typeof deleteChannelRuleSchema>;

export const markReadSchema = z.object({
  lastReadMessageId: z.string().min(1),
});

export const reorderChannelsSchema = z.object({
  channels: z.array(z.object({
    id: z.string(),
    position: z.number().int().min(0),
    parentId: z.string().nullable(),
  })),
});

export const searchMessagesSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ReorderChannelsDto = z.infer<typeof reorderChannelsSchema>;
export type MarkReadDto = z.infer<typeof markReadSchema>;
export type SearchMessagesDto = z.infer<typeof searchMessagesSchema>;
