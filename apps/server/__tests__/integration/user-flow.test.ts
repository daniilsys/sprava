/**
 * Integration tests — end-to-end REST API flows.
 *
 * Uses supertest against the Express app with all middleware in place.
 * Database and external services are still mocked (no Docker required),
 * but we test the full request lifecycle: routing → validation → controller
 * → service → response.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/db.js";
import { makeUser, makeServer, makeChannel, makeMessage, makeMember, makeFriendship, makeDm } from "../helpers/factories.js";

// Mock bcrypt and jwt at module level
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(async () => "$2b$12$hashed"),
    compare: vi.fn(async () => true),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "test-jwt-token"),
    verify: vi.fn(() => ({ userId: "user-1" })),
  },
}));

// Mock hCaptcha middleware to always pass
vi.mock("../../src/middlewares/hcaptcha.middleware.js", () => ({
  hcaptcha: (_req: any, _res: any, next: any) => next(),
}));

// Mock rate limiters to be permissive
vi.mock("../../src/middlewares/rateLimiter.middleware.js", () => ({
  globalLimiter: (_req: any, _res: any, next: any) => next(),
  registerLimiter: (_req: any, _res: any, next: any) => next(),
  loginLimiter: (_req: any, _res: any, next: any) => next(),
  messagesLimiter: (_req: any, _res: any, next: any) => next(),
  forgotPasswordLimiter: (_req: any, _res: any, next: any) => next(),
  uploadLimiter: (_req: any, _res: any, next: any) => next(),
}));

const request = supertest(app);

describe("Integration: Auth Flow", () => {
  // ── Registration ──────────────────────────────────────────────────────────

  it("POST /auth/register — success (201)", async () => {
    const user = makeUser({ id: "new-1", username: "newuser", email: "new@test.com" });

    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    // $transaction passes mockPrisma — mock its models
    vi.mocked(prisma.user.create).mockResolvedValue(user as any);
    vi.mocked(prisma.userProfile.create).mockResolvedValue({} as any);
    vi.mocked(prisma.userSettings.create).mockResolvedValue({} as any);
    vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);
    vi.mocked(prisma.emailVerification.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.emailVerification.create).mockResolvedValue({} as any);

    const res = await request
      .post("/auth/register")
      .send({
        username: "newuser",
        email: "new@test.com",
        password: "password123",
        "h-captcha-response": "test-token",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.user.username).toBe("newuser");
  });

  it("POST /auth/register — validation error (short password)", async () => {
    const res = await request
      .post("/auth/register")
      .send({
        username: "user",
        email: "test@test.com",
        password: "short",
        "h-captcha-response": "test-token",
      });

    expect(res.status).toBe(400);
  });

  it("POST /auth/register — validation error (invalid email)", async () => {
    const res = await request
      .post("/auth/register")
      .send({
        username: "user",
        email: "not-an-email",
        password: "password123",
        "h-captcha-response": "test-token",
      });

    expect(res.status).toBe(400);
  });

  // ── Login ─────────────────────────────────────────────────────────────────

  it("POST /auth/login — success (200)", async () => {
    const user = makeUser({ id: "user-1", verified: true });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
    vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);
    vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 0 });

    const res = await request
      .post("/auth/login")
      .send({
        email: user.email,
        password: "password123",
        "h-captcha-response": "test-token",
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
  });

  it("POST /auth/login — invalid credentials (400)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request
      .post("/auth/login")
      .send({
        email: "unknown@test.com",
        password: "password123",
        "h-captcha-response": "test-token",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("Integration: Server Flow", () => {
  const authHeader = { Authorization: "Bearer test-jwt-token" };

  // ── Create server ─────────────────────────────────────────────────────────

  it("POST /servers — create server (201)", async () => {
    const server = makeServer({ id: "s1", name: "Test Server", ownerId: "user-1" });
    const fullServer = { ...server, members: [], channels: [], roles: [] };

    vi.mocked(prisma.server.create).mockResolvedValue(server as any);
    // First call: generateUniqueInviteCode checks if code exists (should return null)
    // Second call: post-create lookup returns the full server
    vi.mocked(prisma.server.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(fullServer as any);
    vi.mocked(prisma.serverMember.create).mockResolvedValue({} as any);
    vi.mocked(prisma.channel.createMany).mockResolvedValue({ count: 2 } as any);

    const res = await request
      .post("/servers")
      .set(authHeader)
      .send({ name: "Test Server" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Server");
  });

  it("POST /servers — validation error (missing name)", async () => {
    const res = await request.post("/servers").set(authHeader).send({});

    expect(res.status).toBe(400);
  });

  // ── Get server ────────────────────────────────────────────────────────────

  it("GET /servers/:id — as member (200)", async () => {
    vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(makeMember() as any);
    vi.mocked(prisma.server.findUnique).mockResolvedValue(makeServer() as any);

    const res = await request.get("/servers/s1").set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
  });

  // ── Unauthorized ──────────────────────────────────────────────────────────

  it("GET /servers/:id — requires auth (401)", async () => {
    const res = await request.get("/servers/s1");

    expect(res.status).toBe(401);
  });
});

describe("Integration: Channel Message Flow", () => {
  const authHeader = { Authorization: "Bearer test-jwt-token" };

  it("POST /channels/:id/messages — send message (201)", async () => {
    const channel = makeChannel({ id: "ch1", serverId: "s1" });
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({
      ...channel,
      server: {},
    } as any);

    const author = { id: "user-1", username: "test", avatar: null };
    const msg = { ...makeMessage({ id: "msg1", channelId: "ch1" }), content: "Hello!" };

    vi.mocked(prisma.message.create).mockResolvedValue({ ...msg, author } as any);

    const res = await request
      .post("/channels/ch1/messages")
      .set(authHeader)
      .send({ content: "Hello!" });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe("Hello!");
  });

  it("POST /channels/:id/messages — validation error (empty body)", async () => {
    const res = await request
      .post("/channels/ch1/messages")
      .set(authHeader)
      .send({});

    expect(res.status).toBe(400);
  });

  it("GET /channels/:id/messages — get messages (200)", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({
      ...makeChannel(),
      server: {},
    } as any);
    vi.mocked(prisma.message.findMany).mockResolvedValue([]);

    const res = await request.get("/channels/ch1/messages").set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });
});

describe("Integration: DM Flow", () => {
  const authHeader = { Authorization: "Bearer test-jwt-token" };

  it("POST /dm — create 1-1 DM (201)", async () => {
    vi.mocked(prisma.friendship.findFirst).mockResolvedValue({ id: "f1" } as any);
    vi.mocked(prisma.server.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.dmConversation.findFirst).mockResolvedValue(null);

    const dm = makeDm({ id: "dm1", type: "PRIVATE" });
    vi.mocked(prisma.dmConversation.create).mockResolvedValue(dm as any);
    vi.mocked(prisma.dmParticipant.create).mockResolvedValue({} as any);

    const res = await request
      .post("/dm")
      .set(authHeader)
      .send({ participantIds: ["user-1", "user-2"] });

    expect(res.status).toBe(201);
  });

  it("POST /dm — validation error (only 1 participant)", async () => {
    const res = await request
      .post("/dm")
      .set(authHeader)
      .send({ participantIds: ["user-1"] });

    expect(res.status).toBe(400);
  });
});

describe("Integration: Friendship Flow", () => {
  const authHeader = { Authorization: "Bearer test-jwt-token" };

  it("POST /friendships/:receiverId — send request (200)", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(
      makeUser({ id: "user-2", username: "user-2" }) as any,
    );
    vi.mocked(prisma.friendship.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.friendship.create).mockResolvedValue(
      makeFriendship({ senderId: "user-1", receiverId: "user-2" }) as any,
    );

    const res = await request
      .post("/friendships/user-2")
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PENDING");
  });

  it("GET /friendships/friends — list friends (200)", async () => {
    vi.mocked(prisma.friendship.findMany).mockResolvedValue([]);

    const res = await request.get("/friendships/friends").set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });
});

describe("Integration: Message Operations", () => {
  const authHeader = { Authorization: "Bearer test-jwt-token" };

  it("PUT /messages/:id — edit message (200)", async () => {
    const msg = makeMessage({ id: "m1", authorId: "user-1", channelId: "ch1" });
    vi.mocked(prisma.message.findUnique).mockResolvedValue(msg as any);
    vi.mocked(prisma.message.update).mockResolvedValue({
      ...msg,
      content: "edited",
      editedAt: new Date(),
    } as any);

    const res = await request
      .put("/messages/m1")
      .set(authHeader)
      .send({ content: "edited" });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("edited");
  });

  it("DELETE /messages/:id — soft delete message (204)", async () => {
    vi.mocked(prisma.message.findUnique).mockResolvedValue(
      makeMessage({ authorId: "user-1" }) as any,
    );
    vi.mocked(prisma.message.update).mockResolvedValue({} as any);

    const res = await request.delete("/messages/m1").set(authHeader);

    expect(res.status).toBe(204);
  });
});

describe("Integration: User Profile", () => {
  const authHeader = { Authorization: "Bearer test-jwt-token" };

  it("GET /users/me — get authenticated user (200)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...makeUser({ id: "user-1" }),
      profile: { bio: null, location: null, website: null },
      settings: { theme: "dark", language: "en" },
    } as any);

    const res = await request.get("/users/me").set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("user-1");
  });

  it("GET /users/search?q=test — search users (200)", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "u2", username: "testuser", avatar: null },
    ] as any);

    const res = await request.get("/users/search?q=test").set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("Integration: Error Handling", () => {
  const authHeader = { Authorization: "Bearer test-jwt-token" };

  it("should return 404 with code for not-found resources", async () => {
    vi.mocked(prisma.serverMember.findUnique).mockResolvedValue(null);

    const res = await request.get("/servers/nonexistent").set(authHeader);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("code");
  });

  it("should return 400 for Zod validation errors", async () => {
    const res = await request
      .post("/auth/register")
      .send({
        username: "ab",
        email: "bad",
        password: "x",
        "h-captcha-response": "token",
      });

    expect(res.status).toBe(400);
  });
});
