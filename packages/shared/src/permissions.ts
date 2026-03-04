/**
 * Permission bitfield for Sprava servers.
 * Each permission is a power of 2 (1 bit), stored as BigInt.
 *
 * Usage:
 *   Permission.CONFIGURE_CHANNELS       → 4n
 *   PermissionUtils.has(role.permissions, Permission.POST_MESSAGES)
 *   PermissionUtils.combine(Permission.READ_MESSAGES, Permission.POST_MESSAGES)
 */
export const Permission = {
  // ─── Server ─────────────────────────────────────────────────────────────────
  /** Bypasses all restrictions — reserved for trusted moderators. */
  ADMINISTRATOR: 1n << 0n,
  /** Edit the server name, icon, and description. */
  CONFIGURE_SERVER: 1n << 1n,
  /** Create, edit, and delete channels. */
  CONFIGURE_CHANNELS: 1n << 2n,
  /** Create, edit, and delete roles. */
  CONFIGURE_ROLES: 1n << 3n,
  /** Temporarily remove a member from the server. */
  KICK: 1n << 4n,
  /** Permanently ban a member from the server. */
  BAN: 1n << 5n,
  /** Unban a member from the server. */
  UNBAN: 1n << 6n,
  /** Generate invite links to the server. */
  GENERATE_INVITE: 1n << 7n,

  // ─── Text channels ──────────────────────────────────────────────────────────
  /** See the channel in the list and read its content. */
  VIEW_CHANNEL: 1n << 8n,
  /** Read messages in a text channel. */
  READ_MESSAGES: 1n << 9n,
  /** Send messages in text channels. */
  POST_MESSAGES: 1n << 10n,
  /** Access messages sent before the member joined. */
  VIEW_HISTORY: 1n << 11n,
  /** Delete or pin messages from any member. */
  MODERATE_MESSAGES: 1n << 12n,
  /** Attach files and images to messages. */
  UPLOAD: 1n << 13n,
  /** Add emoji reactions to messages. */
  REACT: 1n << 14n,
  /** Use @world (all members) and @online (active members) mentions. */
  NOTIFY_ALL: 1n << 15n,

  // ─── Voice channels ─────────────────────────────────────────────────────────
  /** Join voice channels. */
  JOIN_VOICE: 1n << 16n,
  /** Speak in voice channels. */
  SPEAK: 1n << 17n,
  /** Mute another member's microphone in a voice channel. */
  SILENCE: 1n << 18n,
  /** Deafen another member so they can no longer hear. */
  DEAFEN: 1n << 19n,
} as const;

export type PermissionKey = keyof typeof Permission;

export const PermissionUtils = {
  /** Returns true if the bitfield contains the given permission. */
  has: (bitfield: bigint, permission: bigint): boolean =>
    (bitfield & permission) === permission,

  /** Returns true if the bitfield has ADMINISTRATOR (bypasses all checks). */
  isAdministrator: (bitfield: bigint): boolean =>
    (bitfield & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR,

  /**
   * Returns true if the bitfield grants the permission.
   * ADMINISTRATOR automatically passes every check.
   */
  hasWithAdministrator: (bitfield: bigint, permission: bigint): boolean =>
    PermissionUtils.isAdministrator(bitfield) ||
    PermissionUtils.has(bitfield, permission),

  /** Returns a new bitfield with the given permissions added. */
  add: (bitfield: bigint, ...permissions: bigint[]): bigint =>
    permissions.reduce((acc, p) => acc | p, bitfield),

  /** Returns a new bitfield with the given permissions removed. */
  remove: (bitfield: bigint, ...permissions: bigint[]): bigint =>
    permissions.reduce((acc, p) => acc & ~p, bitfield),

  /** Combines multiple permissions into a single bitfield. */
  combine: (...permissions: bigint[]): bigint =>
    permissions.reduce((acc, p) => acc | p, 0n),

  /** Returns the list of granted permission names from a bitfield. */
  toList: (bitfield: bigint): PermissionKey[] =>
    (Object.keys(Permission) as PermissionKey[]).filter((key) =>
      PermissionUtils.has(bitfield, Permission[key]),
    ),
} as const;
