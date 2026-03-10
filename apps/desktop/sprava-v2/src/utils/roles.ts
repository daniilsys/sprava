import type { Role } from "../types/models";

/**
 * Returns the color of the highest-priority role (lowest position) that has a color.
 * Used for member list usernames and chat author names.
 */
export function getRoleColor(
  roleIds: string[] | undefined,
  rolesMap: Map<string, Role>,
): string | null {
  if (!roleIds) return null;
  let bestPos = Infinity;
  let color: string | null = null;
  for (const rid of roleIds) {
    const role = rolesMap.get(rid);
    if (role?.color && role.position < bestPos) {
      bestPos = role.position;
      color = role.color;
    }
  }
  return color;
}
