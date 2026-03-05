/**
 * Test data factories — create realistic domain objects for assertions.
 */

let seq = 1000;
const nextId = () => String(seq++);

export function makeUser(overrides: Record<string, unknown> = {}) {
  const id = nextId();
  return {
    id,
    username: `user_${id}`,
    email: `user_${id}@test.com`,
    avatar: null,
    passwordHash: "$2b$12$hashedpassword",
    verified: false,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    ...overrides,
  };
}

export function makeServer(overrides: Record<string, unknown> = {}) {
  const id = nextId();
  return {
    id,
    name: `Server ${id}`,
    description: null,
    icon: null,
    inviteCode: `invite_${id}`,
    ownerId: "owner-1",
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    ...overrides,
  };
}

export function makeChannel(overrides: Record<string, unknown> = {}) {
  const id = nextId();
  return {
    id,
    name: `channel-${id}`,
    type: "TEXT" as const,
    serverId: "server-1",
    position: 0,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    ...overrides,
  };
}

export function makeMessage(overrides: Record<string, unknown> = {}) {
  const id = nextId();
  return {
    id,
    content: `Message ${id}`,
    type: "TEXT" as const,
    channelId: "channel-1",
    dmConversationId: null,
    authorId: "user-1",
    replyToId: null,
    editedAt: null,
    deletedAt: null,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    ...overrides,
  };
}

export function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    serverId: "server-1",
    joinedAt: new Date("2026-01-15"),
    ...overrides,
  };
}

export function makeFriendship(overrides: Record<string, unknown> = {}) {
  const id = nextId();
  return {
    id,
    senderId: "user-1",
    receiverId: "user-2",
    status: "PENDING" as const,
    createdAt: new Date("2026-01-15"),
    ...overrides,
  };
}

export function makeRole(overrides: Record<string, unknown> = {}) {
  const id = nextId();
  return {
    id,
    name: `Role ${id}`,
    color: null,
    serverId: "server-1",
    permissions: 0n,
    position: 0,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    ...overrides,
  };
}

export function makeDm(overrides: Record<string, unknown> = {}) {
  const id = nextId();
  return {
    id,
    type: "PRIVATE" as const,
    name: null,
    icon: null,
    ownerId: null,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    ...overrides,
  };
}

export function makeRefreshToken(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId(),
    userId: "user-1",
    token: "refresh-token-abc",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}
