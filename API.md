# Sprava API Documentation

Base URL: `http://localhost:3000`

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Users](#users)
- [Servers](#servers)
- [Roles](#roles)
- [Channels](#channels)
- [Messages](#messages)
- [Direct Messages](#direct-messages)
- [Friendships](#friendships)
- [Uploads](#uploads)
- [Settings](#settings)
- [WebSocket Events](#websocket-events)
- [Voice](#voice)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Permissions](#permissions)

---

## Overview

### Stack
- **Framework**: Express 5 (TypeScript)
- **Database**: PostgreSQL via Prisma 7
- **Cache / Realtime**: Redis (ioredis)
- **WebSocket**: Socket.io 4
- **Auth**: JWT (access + refresh tokens)
- **Validation**: Zod schemas on all endpoints
- **IDs**: Custom Snowflake (string, epoch 2026-01-01)

### Common Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | All POST/PUT/PATCH |
| `Authorization` | `Bearer <accessToken>` | All authenticated routes |

### Common Response Patterns

**Success**: Returns the resource directly (200/201) or empty body (204).

**Pagination**: Cursor-based. Pass `?cursor=<value>&limit=50`. Response:
```json
{
  "data": [...],
  "cursor": "next-cursor-value-or-null"
}
```

---

## Authentication

All auth routes are prefixed with `/auth`.

### POST /auth/register

Create a new account.

**Rate limit**: 5 requests/hour per IP

**Body**:
```json
{
  "username": "string (3-16 chars)",
  "email": "valid email",
  "password": "string (8-100 chars)",
  "h-captcha-response": "hCaptcha token"
}
```

**Response** `201`:
```json
{
  "accessToken": "jwt...",
  "refreshToken": "jwt...",
  "user": {
    "id": "snowflake",
    "username": "john",
    "email": "john@example.com",
    "avatar": null,
    "emailVerified": false,
    "createdAt": "2026-01-15T..."
  }
}
```

**Errors**: `USERNAME_TAKEN`, `EMAIL_TAKEN`

---

### POST /auth/login

Authenticate with credentials.

**Rate limit**: 10 requests/15 min per IP

**Body**:
```json
{
  "email": "valid email",
  "password": "string (8-100 chars)",
  "h-captcha-response": "hCaptcha token"
}
```

**Response** `200`: Same shape as register.

**Errors**: `INVALID_CREDENTIALS`

---

### POST /auth/refresh

Exchange a refresh token for a new access token.

**Body**:
```json
{
  "refreshToken": "jwt..."
}
```

**Response** `200`:
```json
{
  "accessToken": "new-jwt...",
  "refreshToken": "new-refresh-jwt..."
}
```

**Errors**: `INVALID_REFRESH_TOKEN`

---

### POST /auth/logout

Revoke the refresh token.

**Body**:
```json
{
  "refreshToken": "jwt..."
}
```

**Response** `200`: `{ "message": "Logged out" }`

---

### GET /auth/verify-email?token=\<token\>

Verify email address via the token sent by email.

**Query**: `token` (string, from email link)

**Response** `200`: `{ "message": "Email verified" }`

**Errors**: `INVALID_TOKEN`, `TOKEN_EXPIRED`

---

### POST /auth/resend-verification

Resend the verification email. **Requires auth**.

**Response** `200`: `{ "message": "Verification email sent" }`

---

### PATCH /auth/change-password

Change the authenticated user's password. **Requires auth**.

**Body**:
```json
{
  "currentPassword": "string",
  "newPassword": "string (8-100 chars)"
}
```

**Response** `200`: `{ "message": "Password changed" }`

**Errors**: `INVALID_CREDENTIALS`

---

### POST /auth/forgot-password

Request a password reset email.

**Rate limit**: 5 requests/hour per IP

**Body**:
```json
{
  "email": "valid email",
  "h-captcha-response": "hCaptcha token"
}
```

**Response** `200`: `{ "message": "If the email exists, a reset link was sent" }`

---

### POST /auth/reset-password

Reset password using the token from the email.

**Body**:
```json
{
  "token": "reset-token-from-email",
  "password": "string (8-100 chars)"
}
```

**Response** `200`: `{ "message": "Password reset" }`

**Errors**: `INVALID_TOKEN`, `TOKEN_EXPIRED`

---

## Users

All routes prefixed with `/users`. **Requires auth**.

### GET /users/me

Get the authenticated user's full profile.

**Response** `200`:
```json
{
  "id": "snowflake",
  "username": "john",
  "email": "john@example.com",
  "avatar": "https://...",
  "emailVerified": true,
  "createdAt": "2026-01-15T...",
  "profile": {
    "bio": "Hello!",
    "location": "Paris",
    "website": "https://example.com"
  }
}
```

---

### PATCH /users/me

Update account info (username, avatar).

**Body**:
```json
{
  "username": "string (3-16 chars, optional)",
  "avatar": "valid URL (optional)"
}
```

**Response** `200`: Updated user object.

---

### PATCH /users/me/profile

Update profile metadata.

**Body**:
```json
{
  "bio": "string (max 500, optional)",
  "location": "string (max 100, optional)",
  "website": "valid URL (optional)"
}
```

**Response** `200`: Updated profile object.

---

### GET /users/search?q=\<query\>

Search users by username.

**Query**: `q` (string, search term)

**Response** `200`:
```json
[
  { "id": "...", "username": "john", "avatar": "..." }
]
```

---

### GET /users/:username

Get a user's public profile by username.

**Response** `200`: User object (public fields only).

**Errors**: `USER_NOT_FOUND`

---

## Servers

All routes prefixed with `/servers`. **Requires auth**.

### POST /servers/

Create a new server. Automatically creates:
- Owner membership
- `@world` role with default permissions
- `#chat` text channel + `Voice Channel` voice channel

**Body**:
```json
{
  "name": "string (3-50 chars)",
  "icon": "valid URL (optional)",
  "description": "string (max 500, optional)"
}
```

**Response** `201`:
```json
{
  "id": "snowflake",
  "name": "My Server",
  "description": null,
  "icon": null,
  "inviteCode": "abc123",
  "ownerId": "user-id",
  "createdAt": "2026-...",
  "channels": [...],
  "roles": [...],
  "members": [...]
}
```

---

### GET /servers/:id

Get server details. Caller must be a member.

**Response** `200`: Server object.

**Errors**: `SERVER_NOT_FOUND` (also when not a member)

---

### PUT /servers/:id

Update server properties. Requires `CONFIGURE_SERVER` permission.

**Body**:
```json
{
  "name": "string (3-50 chars, optional)",
  "icon": "valid URL (optional)",
  "description": "string (max 500, optional)"
}
```

**Response** `200`: Updated server object.

**Socket broadcast**: `server:updated` to all server members.

---

### DELETE /servers/:id

Delete a server permanently. **Owner only**.

**Response** `204`

**Socket broadcast**: `server:deleted` to all server members before deletion.

**Errors**: `NOT_OWNER`, `SERVER_NOT_FOUND`

---

### POST /servers/join/:code

Join a server by invite code. Requires hCaptcha.

**Response** `200`: Full server object (with channels, roles).

**Socket broadcast**: `server:member_join` to server.

**Errors**: `INVALID_INVITE_CODE`, `ALREADY_MEMBER`

---

### DELETE /servers/leave/:id

Leave a server.

**Response** `204`

**Socket broadcast**: `server:member_leave` to server.

**Errors**: `OWNER_CANNOT_LEAVE`, `SERVER_NOT_FOUND`

---

### GET /servers/:id/channels

List all channels in a server (ordered by position).

**Response** `200`: Array of channel objects.

---

### GET /servers/:id/members

List server members (cursor-paginated).

**Query**: `cursor` (ISO date, optional), `limit` (1-100, default 50)

**Response** `200`:
```json
{
  "data": [
    {
      "userId": "...",
      "serverId": "...",
      "joinedAt": "2026-...",
      "user": { "id": "...", "username": "...", "avatar": "..." },
      "roleIds": ["role-1", "role-2"]
    }
  ],
  "cursor": "2026-01-15T12:00:00.000Z"
}
```

---

### GET /servers/:id/bans

List server bans. Requires `BAN` or `UNBAN` permission. Cursor-paginated.

**Query**: `cursor` (ISO date, optional), `limit` (1-100, default 50)

**Response** `200`:
```json
{
  "data": [
    { "userId": "...", "serverId": "...", "reason": "spam", "bannedAt": "2026-..." }
  ],
  "cursor": null
}
```

---

### DELETE /servers/:id/members/:userId

Kick a member. Requires `KICK` permission + role hierarchy check.

**Response** `204`

**Socket broadcast**: `server:member_leave` to server.

---

### POST /servers/:id/bans/:userId

Ban a member. Requires `BAN` permission + role hierarchy check. Removes membership and role assignments.

**Body** (optional):
```json
{
  "reason": "string"
}
```

**Response** `204`

**Socket broadcast**: `server:member_leave` to server.

---

### DELETE /servers/:id/bans/:userId

Unban a member. Requires `UNBAN` permission.

**Response** `204`

---

### PATCH /servers/:id/owner

Transfer server ownership to another member. Requires hCaptcha. **Owner only**.

**Body**:
```json
{
  "newOwnerId": "user-id",
  "h-captcha-response": "hCaptcha token"
}
```

**Response** `204`

**Socket broadcast**: `server:ownership_transferred` to server.

**Errors**: `NOT_OWNER`, `NEW_OWNER_NOT_MEMBER`

---

## Roles

All routes prefixed with `/servers/:serverId/roles`. **Requires auth**.

### GET /servers/:serverId/roles/

List all roles in a server (ordered by position).

**Response** `200`:
```json
[
  {
    "id": "snowflake",
    "name": "@world",
    "color": null,
    "serverId": "...",
    "permissions": "123456",
    "position": 0,
    "isWorld": true,
    "separate": false
  }
]
```

---

### GET /servers/:serverId/roles/:memberId

Get all roles assigned to a specific member.

**Response** `200`: Array of role objects.

---

### POST /servers/:serverId/roles/

Create a new role. Requires `CONFIGURE_ROLES` permission.

**Body**:
```json
{
  "name": "string (1-32 chars)",
  "color": "#FF5733 (hex, optional, nullable)",
  "permissions": "bitfield string (optional)",
  "position": "integer > 0 (optional)",
  "separate": "boolean (optional)"
}
```

**Response** `201`: Created role object.

**Socket broadcast**: `role:created` to server.

---

### PATCH /servers/:serverId/roles/:roleId

Update a role. Requires `CONFIGURE_ROLES` permission + hierarchy check.

**Body**: Same as create, all fields optional (at least one required).

**Response** `200`: Updated role object.

**Socket broadcast**: `role:updated` to server.

---

### DELETE /servers/:serverId/roles/:roleId

Delete a role. Requires `CONFIGURE_ROLES` permission + hierarchy check.

**Response** `204`

**Socket broadcast**: `role:deleted` to server.

---

### PUT /servers/:serverId/roles/:roleId/permissions

Update a role's permission bitfield directly. Requires `CONFIGURE_ROLES` permission.

**Body**:
```json
{
  "permissions": "bitfield string"
}
```

**Response** `200`: Updated role object.

**Socket broadcast**: `role:updated` to server.

---

### POST /servers/:serverId/roles/:roleId/members/:userId

Assign a role to a member. Requires `CONFIGURE_ROLES` permission + hierarchy check.

**Response** `204`

**Socket broadcast**: `role:assigned` to server + `role:self_assigned` to the target user.

---

### DELETE /servers/:serverId/roles/:roleId/members/:userId

Remove a role from a member. Requires `CONFIGURE_ROLES` permission + hierarchy check.

**Response** `204`

**Socket broadcast**: `role:removed` to server + `role:self_removed` from the target user.

---

## Channels

All routes prefixed with `/channels`. **Requires auth**.

### POST /channels/

Create a new channel. Requires `CONFIGURE_CHANNELS` permission.

**Body**:
```json
{
  "name": "string (1-100 chars)",
  "type": "TEXT | VOICE | PARENT | ANNOUNCEMENT",
  "serverId": "server-id",
  "parentId": "parent-channel-id (optional)"
}
```

**Response** `201`: Channel object.

**Socket broadcast**: `channel:created` to server.

---

### GET /channels/:id

Get channel details. Caller must be a member of the server.

**Response** `200`:
```json
{
  "id": "snowflake",
  "name": "chat",
  "type": "TEXT",
  "position": 0,
  "serverId": "...",
  "parentId": null,
  "syncParentRules": false,
  "lastMessageId": "msg-id-or-null"
}
```

---

### PUT /channels/:id

Update a channel. Requires `CONFIGURE_CHANNELS` permission.

**Body**:
```json
{
  "name": "string (1-100 chars, optional)",
  "type": "TEXT | VOICE | PARENT | ANNOUNCEMENT (optional)",
  "position": "integer (optional)",
  "parentId": "string | null (optional)",
  "syncParentRules": "boolean (optional)"
}
```

**Response** `200`: Updated channel object.

**Socket broadcast**: `channel:updated` to server.

---

### DELETE /channels/:id

Delete a channel. Requires `CONFIGURE_CHANNELS` permission.

**Response** `204`

**Socket broadcast**: `channel:deleted` to server.

---

### PATCH /channels/reorder/:serverId

Reorder channels within a server. Requires `CONFIGURE_CHANNELS` permission.

**Body**:
```json
{
  "channels": [
    { "id": "ch-1", "position": 0, "parentId": null },
    { "id": "ch-2", "position": 1, "parentId": "ch-1" }
  ]
}
```

**Response** `200`: Array of updated channel objects.

**Socket broadcast**: `channel:reordered` to server.

---

### POST /channels/:id/messages

Send a message in a channel. Requires `POST_MESSAGES` permission.

**Rate limit**: 30 messages/minute per user.

**Body**:
```json
{
  "content": "string (max 2000, optional if attachments)",
  "attachments": [
    {
      "url": "presigned URL",
      "filename": "photo.png",
      "size": 123456,
      "mimeType": "image/png"
    }
  ],
  "replyToId": "message-id (optional)"
}
```

At least `content` or `attachments` must be provided.

**Response** `201`: Full message object.

**Socket broadcast**: `channel:message_new` to channel room + `channel:unread_update` to server room.

---

### GET /channels/:id/messages

Get paginated messages for a channel.

**Query**:
- `before` — Message ID, fetch messages before this
- `limit` — Number of messages (default 50, max 100)
- `around` — Message ID, fetch messages around this (for jump-to-message)

**Response** `200`:
```json
{
  "data": [
    {
      "id": "snowflake",
      "type": "TEXT",
      "content": "Hello!",
      "authorId": "user-id",
      "createdAt": "2026-...",
      "editedAt": null,
      "replyToId": null,
      "replyTo": null,
      "author": { "id": "...", "username": "...", "avatar": "..." },
      "reactions": [{ "id": "...", "emoji": "👍", "userId": "..." }],
      "attachments": [{ "id": "...", "url": "...", "filename": "...", "size": 0, "mimeType": "..." }]
    }
  ],
  "cursor": "message-id-or-null"
}
```

---

### GET /channels/:id/rules

Get all permission rules for a channel. Requires membership.

**Response** `200`:
```json
[
  {
    "id": "snowflake",
    "channelId": "ch-1",
    "roleId": "role-1",
    "memberId": null,
    "allow": "768",
    "deny": "0"
  }
]
```

---

### PUT /channels/:id/rules

Create or update a channel permission rule. Requires `CONFIGURE_CHANNELS` permission.

**Body**:
```json
{
  "roleId": "role-id (exactly one of roleId/memberId)",
  "memberId": "user-id (exactly one of roleId/memberId)",
  "allow": "permission bitfield string (default '0')",
  "deny": "permission bitfield string (default '0')"
}
```

**Response** `200`: Channel rule object.

**Socket broadcast**: `channel:rule_updated` to server.

---

### DELETE /channels/:id/rules

Delete a channel permission rule. Requires `CONFIGURE_CHANNELS` permission.

**Body**:
```json
{
  "roleId": "role-id (exactly one of roleId/memberId)",
  "memberId": "user-id (exactly one of roleId/memberId)"
}
```

**Response** `204`

**Socket broadcast**: `channel:rule_deleted` to server.

---

### GET /channels/:id/read

Get read state for a channel (the last message ID the user has read).

**Response** `200`:
```json
{
  "lastReadMessageId": "msg-id"
}
```

---

### POST /channels/:id/read

Update read state for a channel.

**Body**:
```json
{
  "lastReadMessageId": "msg-id"
}
```

**Response** `200`: Updated read state.

---

## Messages

All routes prefixed with `/messages`. **Requires auth**.

### PUT /messages/:messageId

Edit a message. Only the author can edit.

**Body**:
```json
{
  "content": "string (optional)"
}
```

**Response** `200`: Updated message object.

**Socket broadcast**: `channel:message_edit` or `dm:message_edit`.

---

### DELETE /messages/:messageId

Soft-delete a message. Author or users with `MODERATE_MESSAGES` permission.

**Response** `204`

**Socket broadcast**: `channel:message_delete` or `dm:message_delete`.

---

### POST /messages/:messageId/reactions

Add a reaction to a message. Requires `REACT` permission (for channels).

**Body**:
```json
{
  "emoji": "👍"
}
```

**Response** `201`: Reaction object.

**Socket broadcast**: `channel:reaction_add` or `dm:reaction_add`.

---

### DELETE /messages/:messageId/reactions

Remove a reaction from a message.

**Body**:
```json
{
  "emoji": "👍"
}
```

**Response** `204`

**Socket broadcast**: `channel:reaction_remove` or `dm:reaction_remove`.

---

### POST /messages/:messageId/reply

Reply to a message with a quote reference.

**Rate limit**: 30 messages/minute per user.

**Body**:
```json
{
  "content": "string (max 2000, optional if attachments)",
  "attachments": [{ "url": "...", "filename": "...", "size": 0, "mimeType": "..." }]
}
```

**Response** `201`: Message object with `replyToId` and `replyTo` populated.

---

## Direct Messages

All routes prefixed with `/dm`. **Requires auth**.

### POST /dm/

Create a DM conversation (1-on-1 or group).

**Body**:
```json
{
  "participantIds": ["user-id-1", "user-id-2"]
}
```

`participantIds` must include the caller. Min 2, max 10. If exactly 2 and a 1-on-1 DM already exists, returns the existing one.

**Response** `201`: DM conversation object.

**Socket broadcast**: `dm:created` to all participants.

---

### GET /dm/

Get all DM conversations for the authenticated user.

**Response** `200`: Array of DM conversation objects with participants.

---

### PATCH /dm/:id

Update a group DM (name, icon). Only group owner.

**Body**:
```json
{
  "name": "string (optional)",
  "icon": "URL string (optional)"
}
```

**Response** `200`: Updated DM object.

**Socket broadcast**: `dm:updated` to all participants.

---

### DELETE /dm/:id/leave

Leave a group DM conversation.

**Response** `204`

**Socket broadcast**: `dm:participant_left` to remaining participants.

---

### POST /dm/:id/participants/:participantId

Add a participant to a group DM. Only group owner.

**Response** `201`

**Socket broadcast**: `dm:participant_added` to all participants.

---

### DELETE /dm/:id/participants/:participantId

Remove a participant from a group DM. Only group owner.

**Response** `204`

**Socket broadcast**: `dm:participant_removed` to all participants.

---

### POST /dm/:id/messages

Send a message in a DM conversation.

**Rate limit**: 30 messages/minute per user.

**Body**: Same as channel messages.

**Response** `201`: Message object.

**Socket broadcast**: `dm:message_new` to DM room.

---

### GET /dm/:id/messages

Get paginated messages in a DM conversation.

**Query**: `before`, `limit`, `around` (same as channel messages).

**Response** `200`: Same shape as channel messages.

---

### GET /dm/:id/messages/search

Search messages in a DM conversation.

**Query**: `q` (search term), `limit` (optional)

**Response** `200`: Array of matching messages.

---

### GET /dm/:id/read

Get DM read state.

**Response** `200`: `{ "lastReadMessageId": "..." }`

---

### POST /dm/:id/read

Update DM read state.

**Body**: `{ "lastReadMessageId": "msg-id" }`

**Response** `200`: Updated read state.

---

## Friendships

All routes prefixed with `/friendships`. **Requires auth**.

### POST /friendships/:username

Send a friend request by username.

**Response** `201`:
```json
{
  "receiverId": "user-id",
  "status": "PENDING",
  "createdAt": "2026-..."
}
```

**Socket broadcast**: `friendship:request_sent` to sender, `friendship:request_received` to receiver.

**Errors**: `USER_NOT_FOUND`, `PENDING_FRIENDSHIP_EXISTS`, `ALREADY_FRIENDS`

---

### PUT /friendships/

Accept a friend request or block a user.

**Body**:
```json
{
  "status": "ACCEPTED | BLOCKED",
  "receiverId": "user-id"
}
```

**Response** `200`: Updated friendship status.

**Socket broadcast**: `friendship:accepted` to both users (for ACCEPTED), `friendship:blocked` to blocker (for BLOCKED).

**Errors**: `FRIENDSHIP_NOT_FOUND`, `ALREADY_ACCEPTED_FRIENDSHIP`, `NOT_RECEIVER`

---

### DELETE /friendships/:receiverId

Cancel an outgoing friend request. Sender only.

**Response** `200`: `{ "message": "Friendship request cancelled" }`

**Socket broadcast**: `friendship:cancelled` to receiver.

**Errors**: `FRIENDSHIP_NOT_FOUND`, `INVALID_FRIENDSHIP_STATUS`, `NOT_SENDER`

---

### DELETE /friendships/:receiverId/reject

Reject an incoming friend request. Receiver only.

**Response** `200`: `{ "message": "Friendship request rejected" }`

**Socket broadcast**: `friendship:rejected` to sender.

---

### DELETE /friendships/:receiverId/remove

Remove an accepted friend.

**Response** `200`: `{ "message": "Friendship removed" }`

**Socket broadcast**: `friendship:removed` to both users.

---

### DELETE /friendships/:receiverId/unblock

Unblock a user. Only the blocker can unblock.

**Response** `200`: `{ "message": "User unblocked" }`

**Socket broadcast**: `friendship:unblocked` to unblocker.

---

### GET /friendships/friends

Get all accepted friends.

**Response** `200`:
```json
[
  {
    "id": "friendship-id",
    "status": "ACCEPTED",
    "createdAt": "2026-...",
    "sender": { "id": "...", "username": "...", "avatar": "..." },
    "receiver": { "id": "...", "username": "...", "avatar": "..." }
  }
]
```

---

### GET /friendships/blocked

Get all blocked users.

**Response** `200`: Same shape as friends.

---

### GET /friendships/requests

Get incoming friend requests (PENDING where you are the receiver).

**Response** `200`: Same shape as friends.

---

### GET /friendships/requests/sent

Get outgoing friend requests (PENDING where you are the sender).

**Response** `200`: Same shape as friends.

---

## Uploads

All routes prefixed with `/uploads`. **Requires auth**.

All upload endpoints return a presigned URL for direct-to-storage upload. The client uploads the file directly to the storage URL, then includes the URL in the relevant API call (avatar update, message attachment, etc.).

**Rate limit**: 20 uploads/hour per user.

### POST /uploads/avatar

Get presigned URL for a user avatar upload.

**Body**:
```json
{
  "filename": "photo.jpg",
  "contentType": "image/jpeg | image/png | image/webp",
  "size": 123456
}
```

**Max size**: 4 MB

**Response** `200`:
```json
{
  "uploadUrl": "https://storage.../presigned...",
  "fileUrl": "https://cdn.../avatars/user-id/photo.jpg"
}
```

---

### POST /uploads/attachment

Get presigned URL for a message attachment.

**Body**:
```json
{
  "filename": "document.pdf",
  "contentType": "see supported types below",
  "size": 5000000
}
```

**Max size**: 10 MB

**Supported types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`, `video/quicktime`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/webm`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/plain`, `application/zip`, `application/x-tar`, `application/gzip`

---

### POST /uploads/server-icon

Get presigned URL for a server icon upload.

**Body**:
```json
{
  "filename": "icon.png",
  "contentType": "image/jpeg | image/png | image/webp",
  "size": 123456,
  "serverId": "server-id"
}
```

**Max size**: 4 MB

---

### POST /uploads/group-icon

Get presigned URL for a group DM icon upload.

**Body**:
```json
{
  "filename": "group.png",
  "contentType": "image/jpeg | image/png | image/webp",
  "size": 123456,
  "dmId": "dm-conversation-id"
}
```

**Max size**: 4 MB

---

## Settings

All routes prefixed with `/settings`. **Requires auth**.

### GET /settings/

Get user settings.

**Response** `200`:
```json
{
  "theme": "DARK",
  "language": "en",
  "showLocation": "PUBLIC",
  "showActivity": "PUBLIC",
  "showStatus": "PUBLIC",
  "showEmail": "FRIENDS_ONLY",
  "showWebsite": "PUBLIC",
  "dmPrivacy": "COMMON_SERVER",
  "noiseCancellation": "OFF"
}
```

---

### PATCH /settings/

Update user settings. At least one field required.

**Body**:
```json
{
  "theme": "LIGHT | DARK | SYSTEM",
  "language": "en | fr",
  "showLocation": "PUBLIC | FRIENDS_ONLY | NOBODY",
  "showActivity": "PUBLIC | FRIENDS_ONLY | NOBODY",
  "showStatus": "PUBLIC | FRIENDS_ONLY | NOBODY",
  "showEmail": "PUBLIC | FRIENDS_ONLY | NOBODY",
  "showWebsite": "PUBLIC | FRIENDS_ONLY | NOBODY",
  "dmPrivacy": "COMMON_SERVER | FRIENDS_ONLY",
  "noiseCancellation": "OFF | LIGHT | HIGH_QUALITY"
}
```

**Response** `200`: Updated settings object.

---

## WebSocket Events

Connect to the Socket.io server at the same host/port as the REST API. Authentication is done via the `auth` option:

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: { token: "access-token-jwt" }
});
```

### Connection Flow

1. Client connects with JWT token
2. Server validates token, joins the socket to rooms: `user:{userId}`, `server:{serverId}` (for each server), `dm:{dmId}` (for each DM)
3. Server emits `ready` event with full initial state
4. Client hydrates local state from `ready` payload
5. Client emits `presence:subscribe` for friends + DM participants
6. Client emits `channel:focus` when viewing a specific channel

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | `{ user, servers, friendships, dms, readStates, voiceStates, memberRoleIds, presenceStates, channelRules }` | Full initial state on connect |
| `channel:created` | `{ channel }` | New channel in a server |
| `channel:updated` | `{ channel }` | Channel metadata changed |
| `channel:deleted` | `{ channelId, serverId }` | Channel deleted |
| `channel:rule_updated` | `{ serverId, rule }` | Channel permission rule upserted |
| `channel:rule_deleted` | `{ serverId, channelId, roleId, memberId }` | Channel permission rule deleted |
| `channel:message_new` | `{ message }` | New message in focused channel |
| `channel:message_edit` | `{ id, content, editedAt, channelId }` | Message edited |
| `channel:message_delete` | `{ messageId, channelId }` | Message deleted |
| `channel:typing` | `{ userId, channelId, typing }` | Typing indicator |
| `channel:reaction_add` | `{ messageId, channelId, reaction }` | Reaction added |
| `channel:reaction_remove` | `{ messageId, channelId, reaction }` | Reaction removed |
| `channel:unread_update` | `{ channelId, messageId, authorId }` | New message in unfocused channel |
| `dm:created` | `{ dm }` | New DM conversation |
| `dm:message_new` | `{ message, dmConversationId }` | New DM message |
| `dm:message_edit` | `{ id, content, editedAt, dmConversationId }` | DM message edited |
| `dm:message_delete` | `{ messageId, dmConversationId }` | DM message deleted |
| `dm:typing` | `{ userId, dmConversationId, typing }` | DM typing indicator |
| `dm:reaction_add` | `{ messageId, dmConversationId, reaction }` | DM reaction added |
| `dm:reaction_remove` | `{ messageId, dmConversationId, reaction }` | DM reaction removed |
| `server:updated` | `{ server }` | Server info changed |
| `server:deleted` | `{ serverId }` | Server deleted |
| `server:member_join` | `{ serverId, userId, member }` | Member joined |
| `server:member_leave` | `{ serverId, userId }` | Member left/kicked/banned |
| `server:ownership_transferred` | `{ serverId, newOwnerId }` | Owner changed |
| `server:members_chunk` | `{ serverId, members, cursor }` | Paginated member response |
| `user:presence` | `{ userId, status, statusMessage }` | Presence change for subscribed user |
| `presence:state` | `{ states: Record<userId, { status, statusMessage }> }` | Bulk presence response |
| `role:created` | `{ serverId, role }` | Role created |
| `role:updated` | `{ serverId, role }` | Role updated |
| `role:deleted` | `{ serverId, roleId }` | Role deleted |
| `role:assigned` | `{ serverId, userId, roleId }` | Role assigned to member |
| `role:removed` | `{ serverId, userId, roleId }` | Role removed from member |
| `role:self_assigned` | `{ serverId, roleId }` | Current user received a role |
| `role:self_removed` | `{ serverId, roleId }` | Current user lost a role |
| `friendship:request_received` | `{ friendship }` | Incoming friend request |
| `friendship:request_sent` | `{ friendship }` | Outgoing request confirmation |
| `friendship:accepted` | `{ friendship }` | Friend request accepted |
| `friendship:cancelled` | `{ friendshipId }` | Request cancelled by sender |
| `friendship:rejected` | `{ friendshipId }` | Request rejected by receiver |
| `friendship:removed` | `{ friendshipId }` | Friend removed |
| `friendship:blocked` | `{ friendship }` | User blocked |
| `friendship:unblocked` | `{ friendshipId }` | User unblocked |

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `typing:start` | `{ channelId? \| dmConversationId? }` | Started typing |
| `typing:stop` | `{ channelId? \| dmConversationId? }` | Stopped typing |
| `channel:read` | `{ channelId, lastReadMessageId }` | Mark channel read |
| `dm:read` | `{ dmConversationId, lastReadMessageId }` | Mark DM read |
| `presence:subscribe` | `{ userIds: string[] }` | Subscribe to presence (max 200/call, 2000 total) |
| `presence:unsubscribe` | `{ userIds: string[] }` | Unsubscribe from presence |
| `channel:focus` | `{ channelId: string \| null }` | Set focused channel (joins room) |
| `server:request_members` | `{ serverId, cursor? }` | Request member chunk (50/page) |
| `user:set_status` | `{ status, statusMessage? }` | Set user status |

---

## Voice

Voice uses a two-tier architecture:
- **Gateway** (this server): handles signaling via Socket.io
- **SFU** (`apps/voice-sfu`): mediasoup workers for media routing, communicates via Redis RPC

### Voice Flow

1. Client emits `voice:join` with `{ channelId }` or `{ dmConversationId }`
2. Server responds with `voice:joined` containing transport params + router RTP capabilities
3. Client creates local mediasoup transports, emits `voice:connect_transport` for DTLS handshake
4. Server responds with `voice:transport_ok`
5. Client produces audio, emits `voice:produce`
6. Server responds with `voice:produce_ok` + broadcasts `voice:new_producer` to room
7. Other clients emit `voice:consume_request` to receive the track
8. Server responds with `voice:consumer_ready`

### Voice Client → Server Events

| Event | Payload |
|-------|---------|
| `voice:join` | `{ channelId? \| dmConversationId? }` |
| `voice:leave` | `(none)` |
| `voice:connect_transport` | `{ transportId, dtlsParameters }` |
| `voice:produce` | `{ transportId, kind, rtpParameters }` |
| `voice:consume_request` | `{ producerId, rtpCapabilities }` |

### Voice Server → Client Events

| Event | Payload |
|-------|---------|
| `voice:joined` | `{ transportParams, routerRtpCapabilities, existingProducers, voiceStates }` |
| `voice:left` | `(none)` |
| `voice:user_joined` | `{ userId, roomId }` |
| `voice:user_left` | `{ userId, roomId }` |
| `voice:transport_ok` | `(none)` |
| `voice:produce_ok` | `{ producerId }` |
| `voice:new_producer` | `{ producerId, userId, kind }` |
| `voice:consumer_ready` | `{ consumerId, producerId, kind, rtpParameters }` |
| `voice:error` | `{ code, message }` |
| `voice:dm_call_incoming` | `{ dmConversationId, callerId }` |
| `voice:dm_call_ended` | `{ dmConversationId }` |

### Voice State

Voice state is stored in Redis only (no DB model):
- `voice:user:{userId}` → `{ roomId, joinedAt }` (TTL 24h)
- `voice:room:{roomId}:members` → Redis SET of userIds
- Room ID format: `"channel:{channelId}"` or `"dm:{dmConversationId}"`

---

## Error Handling

All errors follow this shape:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable message"
}
```

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request (validation, business rule) |
| 401 | Unauthorized (missing/expired token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Zod schema validation failed |
| `INVALID_CREDENTIALS` | Wrong email/password |
| `INVALID_REFRESH_TOKEN` | Expired or revoked refresh token |
| `SERVER_NOT_FOUND` | Server doesn't exist or user isn't a member |
| `MEMBER_NOT_FOUND` | Member not found in server |
| `NOT_OWNER` | Action requires server owner |
| `OWNER_CANNOT_LEAVE` | Owner must transfer ownership first |
| `ALREADY_MEMBER` | User is already in the server |
| `INVALID_INVITE_CODE` | Invite code doesn't match any server |
| `INSUFFICIENT_PERMISSIONS` | Missing required permission |
| `ROLE_HIERARCHY` | Target user has a higher role |
| `USER_NOT_FOUND` | User doesn't exist |
| `FRIENDSHIP_NOT_FOUND` | No friendship between users |
| `ALREADY_FRIENDS` | Users are already friends |
| `PENDING_FRIENDSHIP_EXISTS` | A pending request already exists |
| `TOO_MANY_REQUESTS` | Rate limit exceeded |

---

## Rate Limits

Rate limit headers follow [RFC draft-7](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) format.

| Endpoint | Window | Limit | Key |
|----------|--------|-------|-----|
| Global (all routes) | 15 min | 300 | User ID or IP |
| `POST /auth/register` | 1 hour | 5 | IP |
| `POST /auth/login` | 15 min | 10 | IP |
| `POST /auth/forgot-password` | 1 hour | 5 | IP |
| Message sending (channels + DMs) | 1 min | 30 | User ID |
| Uploads (all presign routes) | 1 hour | 20 | User ID |

### Socket.io Rate Limits (per socket)

| Event | Limit | Window |
|-------|-------|--------|
| `typing:start` / `typing:stop` | 5 | 5 sec |
| `user:set_status` | 2 | 5 sec |
| `presence:subscribe` / `unsubscribe` | 10 | 5 sec |
| `channel:focus` | 20 | 5 sec |
| `server:request_members` | 5 | 5 sec |

---

## Permissions

Permissions use a BigInt bitfield system. Each permission is a single bit. Roles have a `permissions` field that is the OR of all granted bits. The `@world` role applies to all server members implicitly.

### Permission Bits

| Permission | Bit | Value | Description |
|-----------|-----|-------|-------------|
| `ADMINISTRATOR` | 0 | `1` | Bypasses all permission checks |
| `CONFIGURE_SERVER` | 1 | `2` | Edit server name, icon, description |
| `CONFIGURE_CHANNELS` | 2 | `4` | Create, edit, delete channels |
| `CONFIGURE_ROLES` | 3 | `8` | Create, edit, delete roles |
| `KICK` | 4 | `16` | Kick members |
| `BAN` | 5 | `32` | Ban members |
| `UNBAN` | 6 | `64` | Unban members |
| `GENERATE_INVITE` | 7 | `128` | Generate invite links |
| `VIEW_CHANNEL` | 8 | `256` | See channel in list |
| `READ_MESSAGES` | 9 | `512` | Read messages |
| `POST_MESSAGES` | 10 | `1024` | Send messages |
| `VIEW_HISTORY` | 11 | `2048` | See messages before join |
| `MODERATE_MESSAGES` | 12 | `4096` | Delete/pin others' messages |
| `UPLOAD` | 13 | `8192` | Attach files |
| `REACT` | 14 | `16384` | Add reactions |
| `NOTIFY_ALL` | 15 | `32768` | Use @world and @online mentions |
| `JOIN_VOICE` | 16 | `65536` | Join voice channels |
| `SPEAK` | 17 | `131072` | Speak in voice channels |
| `SILENCE` | 18 | `262144` | Server-mute another member |
| `DEAFEN` | 19 | `524288` | Server-deafen another member |

### Default @world Permissions

Every new server's `@world` role gets: `VIEW_CHANNEL | READ_MESSAGES | POST_MESSAGES | VIEW_HISTORY | UPLOAD | REACT | JOIN_VOICE | SPEAK | GENERATE_INVITE`

### Permission Resolution Order

**Server level**: `@world` role permissions → OR with assigned role permissions → if ADMINISTRATOR, all permissions granted.

**Channel level** (overrides): Base server perms → apply `@world` channel rule (deny then allow) → combine all role channel rules (deny then allow) → apply member-specific channel rule (deny then allow). ADMINISTRATOR bypasses channel rules entirely.

### API Format

Permissions are sent as decimal string representations of BigInt values:
```json
{
  "permissions": "209664"
}
```

To check a permission: `(BigInt(permissions) & BigInt(bit)) === BigInt(bit)`
