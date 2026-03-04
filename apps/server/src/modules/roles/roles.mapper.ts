type RoleInput = {
  id: string;
  name: string;
  color: string | null;
  serverId: string;
  permissions: bigint;
  position: number;
};

/** Serializes permissions BigInt to string (JSON-safe). */
export function toRoleResponse(role: RoleInput) {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    serverId: role.serverId,
    permissions: role.permissions.toString(),
    position: role.position,
  };
}

export type RoleResponse = ReturnType<typeof toRoleResponse>;
