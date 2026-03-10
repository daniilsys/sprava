import { z } from "zod";

export const auditLogQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actionType: z.string().optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuery>;
