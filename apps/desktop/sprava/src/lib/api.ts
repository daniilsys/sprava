import { invoke } from "@tauri-apps/api/core";

export const api = {
  auth: {
    register: (body: Record<string, unknown>) =>
      invoke("auth_register", { body }),
    login: (body: Record<string, unknown>) => invoke("auth_login", { body }),
    logout: () => invoke("auth_logout"),
    verifyEmail: (token: string) => invoke("auth_verify_email", { token }),
    resendVerification: () => invoke("auth_resend_verification"),
    changePassword: (body: Record<string, unknown>) =>
      invoke("auth_change_password", { body }),
    forgotPassword: (body: Record<string, unknown>) =>
      invoke("auth_forgot_password", { body }),
    resetPassword: (body: Record<string, unknown>) =>
      invoke("auth_reset_password", { body }),
  },

  token: {
    getAccessToken: () => invoke<string | null>("get_access_token"),
    hasSession: () => invoke<boolean>("has_session"),
  },

  users: {
    getMe: () => invoke("users_get_me"),
    updateAccount: (body: Record<string, unknown>) =>
      invoke("users_update_account", { body }),
    updateProfile: (body: Record<string, unknown>) =>
      invoke("users_update_profile", { body }),
    search: (query: string) => invoke("users_search", { query }),
    getByUsername: (username: string) =>
      invoke("users_get_by_username", { username }),
  },

  servers: {
    create: (body: Record<string, unknown>) =>
      invoke("server_create", { body }),
    getById: (id: string) => invoke("server_get_by_id", { id }),
    update: (id: string, body: Record<string, unknown>) =>
      invoke("server_update", { id, body }),
    delete: (id: string) => invoke("server_delete", { id }),
    getChannels: (id: string) => invoke("server_get_channels", { id }),
    getMembers: (id: string, cursor?: string, limit?: number) =>
      invoke("server_get_members", { id, cursor, limit }),
    getBans: (id: string, cursor?: string, limit?: number) =>
      invoke("server_get_bans", { id, cursor, limit }),
    kickMember: (serverId: string, userId: string) =>
      invoke("server_kick_member", { serverId, userId }),
    banMember: (serverId: string, userId: string, body: { reason?: string }) =>
      invoke("server_ban_member", { serverId, userId, body }),
    unbanMember: (serverId: string, userId: string) =>
      invoke("server_unban_member", { serverId, userId }),
    preview: (code: string) => invoke("server_preview", { code }),
    join: (code: string, body: Record<string, unknown>) =>
      invoke("server_join", { code, body }),
    leave: (id: string) => invoke("server_leave", { id }),
    regenerateInvite: (id: string) => invoke("server_regenerate_invite", { id }),
    transferOwnership: (id: string, body: Record<string, unknown>) =>
      invoke("server_transfer_ownership", { id, body }),
    getAuditLog: (id: string, cursor?: string, limit?: number, actionType?: string) =>
      invoke("server_get_audit_log", { id, cursor, limit, actionType }),
  },

  roles: {
    list: (serverId: string) => invoke("roles_list", { serverId }),
    getMemberRoles: (serverId: string, memberId: string) =>
      invoke("roles_get_member_roles", { serverId, memberId }),
    create: (serverId: string, body: Record<string, unknown>) =>
      invoke("roles_create", { serverId, body }),
    update: (serverId: string, roleId: string, body: Record<string, unknown>) =>
      invoke("roles_update", { serverId, roleId, body }),
    delete: (serverId: string, roleId: string) =>
      invoke("roles_delete", { serverId, roleId }),
    updatePermissions: (
      serverId: string,
      roleId: string,
      body: Record<string, unknown>,
    ) => invoke("roles_update_permissions", { serverId, roleId, body }),
    assignToMember: (serverId: string, roleId: string, userId: string) =>
      invoke("roles_assign_to_member", { serverId, roleId, userId }),
    removeFromMember: (serverId: string, roleId: string, userId: string) =>
      invoke("roles_remove_from_member", { serverId, roleId, userId }),
  },

  channels: {
    create: (body: Record<string, unknown>) =>
      invoke("channel_create", { body }),
    getById: (id: string) => invoke("channel_get_by_id", { id }),
    update: (id: string, body: Record<string, unknown>) =>
      invoke("channel_update", { id, body }),
    reorder: (serverId: string, channels: Array<{ id: string; position: number; parentId: string | null }>) =>
      invoke("channel_reorder", { serverId, body: { channels } }),
    delete: (id: string) => invoke("channel_delete", { id }),
    sendMessage: (id: string, body: Record<string, unknown>) =>
      invoke("channel_send_message", { id, body }),
    getMessages: (id: string, before?: string, limit?: number, around?: string) =>
      invoke("channel_get_messages", { id, before, limit, around }),
    getRules: (id: string) => invoke("channel_get_rules", { id }),
    upsertRule: (id: string, body: Record<string, unknown>) =>
      invoke("channel_upsert_rule", { id, body }),
    deleteRule: (id: string, body: Record<string, unknown>) =>
      invoke("channel_delete_rule", { id, body }),
    searchMessages: (id: string, query: string) =>
      invoke("channel_search_messages", { id, q: query }),
    pinMessage: (id: string, body: Record<string, unknown>) =>
      invoke("channel_pin_message", { id, body }),
    unpinMessage: (id: string, body: Record<string, unknown>) =>
      invoke("channel_unpin_message", { id, body }),
    getPins: (id: string) => invoke("channel_get_pins", { id }),
    getReadState: (id: string) => invoke("channel_get_read_state", { id }),
    updateReadState: (id: string, body: Record<string, unknown>) =>
      invoke("channel_update_read_state", { id, body }),
  },

  dm: {
    create: (body: Record<string, unknown>) => invoke("dm_create", { body }),
    getConversations: () => invoke("dm_get_conversations"),
    update: (id: string, body: Record<string, unknown>) =>
      invoke("dm_update", { id, body }),
    leaveGroup: (id: string) => invoke("dm_leave_group", { id }),
    addParticipant: (id: string, participantId: string) =>
      invoke("dm_add_participant", { id, participantId }),
    removeParticipant: (id: string, participantId: string) =>
      invoke("dm_remove_participant", { id, participantId }),
    sendMessage: (id: string, body: Record<string, unknown>) =>
      invoke("dm_send_message", { id, body }),
    getMessages: (id: string, before?: string, limit?: number, around?: string) =>
      invoke("dm_get_messages", { id, before, limit, around }),
    searchMessages: (id: string, query: string) =>
      invoke("dm_search_messages", { id, q: query }),
    pinMessage: (id: string, body: Record<string, unknown>) =>
      invoke("dm_pin_message", { id, body }),
    unpinMessage: (id: string, body: Record<string, unknown>) =>
      invoke("dm_unpin_message", { id, body }),
    getPins: (id: string) => invoke("dm_get_pins", { id }),
    getReadState: (id: string) => invoke("dm_get_read_state", { id }),
    updateReadState: (id: string, body: Record<string, unknown>) =>
      invoke("dm_update_read_state", { id, body }),
  },

  messages: {
    edit: (messageId: string, body: Record<string, unknown>) =>
      invoke("message_edit", { messageId, body }),
    delete: (messageId: string) => invoke("message_delete", { messageId }),
    addReaction: (messageId: string, body: Record<string, unknown>) =>
      invoke("message_add_reaction", { messageId, body }),
    removeReaction: (messageId: string, body: Record<string, unknown>) =>
      invoke("message_remove_reaction", { messageId, body }),
    reply: (messageId: string, body: Record<string, unknown>) =>
      invoke("message_reply", { messageId, body }),
  },

  friendships: {
    sendRequest: (username: string) =>
      invoke("friendship_send_request", { username }),
    update: (body: Record<string, unknown>) =>
      invoke("friendship_update", { body }),
    cancelRequest: (receiverId: string) =>
      invoke("friendship_cancel_request", { receiverId }),
    rejectRequest: (receiverId: string) =>
      invoke("friendship_reject_request", { receiverId }),
    remove: (receiverId: string) =>
      invoke("friendship_remove", { receiverId }),
    unblock: (receiverId: string) =>
      invoke("friendship_unblock", { receiverId }),
    getFriends: () => invoke("friendship_get_friends"),
    getBlocked: () => invoke("friendship_get_blocked"),
    getRequests: () => invoke("friendship_get_requests"),
    getSentRequests: () => invoke("friendship_get_sent_requests"),
  },

  uploads: {
    presignAvatar: (body: Record<string, unknown>) =>
      invoke("upload_presign_avatar", { body }),
    presignAttachment: (body: Record<string, unknown>) =>
      invoke("upload_presign_attachment", { body }),
    presignServerIcon: (body: Record<string, unknown>) =>
      invoke("upload_presign_server_icon", { body }),
    presignGroupIcon: (body: Record<string, unknown>) =>
      invoke("upload_presign_group_icon", { body }),
  },

  settings: {
    get: () => invoke("settings_get"),
    update: (body: Record<string, unknown>) =>
      invoke("settings_update", { body }),
  },
};
