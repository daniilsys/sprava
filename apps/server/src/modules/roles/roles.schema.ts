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

export const createRoleSchema = z.object({
  name: z.string().min(1).max(32),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional(),
  permissions: permissionBitfield.optional(),
  position: z.number().int().positive().optional(),
});

export const updateRoleSchema = createRoleSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const updatePermissionsSchema = z.object({
  permissions: permissionBitfield,
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
export type UpdatePermissionsDto = z.infer<typeof updatePermissionsSchema>;
