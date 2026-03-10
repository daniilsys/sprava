/**
 * Global test setup — runs before every test file.
 * Registers module-level mocks so service imports get the fakes.
 */
import { vi } from "vitest";

// ─── Stable Prisma mock ─────────────────────────────────────────────────────
// Each model has fixed vi.fn() references so vi.mocked() works consistently.

function createModelMock() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

const mockPrisma = {
  user: createModelMock(),
  userProfile: createModelMock(),
  userSettings: createModelMock(),
  refreshToken: createModelMock(),
  emailVerification: createModelMock(),
  passwordReset: createModelMock(),
  server: createModelMock(),
  serverMember: createModelMock(),
  serverBan: createModelMock(),
  channel: createModelMock(),
  channelRule: createModelMock(),
  message: createModelMock(),
  attachment: createModelMock(),
  reaction: createModelMock(),
  readState: createModelMock(),
  friendship: createModelMock(),
  dmConversation: createModelMock(),
  dmParticipant: createModelMock(),
  role: createModelMock(),
  memberRole: createModelMock(),
  userStatus: createModelMock(),
  auditLog: createModelMock(),
  pin: createModelMock(),
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") return arg(mockPrisma);
    return Promise.all(arg as Promise<unknown>[]);
  }),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
};

vi.mock("../src/config/db.js", () => ({ prisma: mockPrisma }));

// ─── Mock: Redis ────────────────────────────────────────────────────────────

const mockRedis = {
  get: vi.fn(async () => null),
  set: vi.fn(async () => "OK"),
  setex: vi.fn(async () => "OK"),
  del: vi.fn(async () => 1),
  sadd: vi.fn(async () => 1),
  srem: vi.fn(async () => 1),
  smembers: vi.fn(async () => []),
  scard: vi.fn(async () => 0),
  expire: vi.fn(async () => 1),
  pipeline: vi.fn(() => ({
    sadd: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(),
    smembers: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn(async () => []),
  })),
  duplicate: vi.fn(),
};

vi.mock("../src/config/redis.js", () => ({ redis: mockRedis }));

// ─── Mock: Socket.io getIO ──────────────────────────────────────────────────

function createMockIO() {
  const chainable = {
    emit: vi.fn(),
    socketsJoin: vi.fn(),
    socketsLeave: vi.fn(),
  };
  return {
    to: vi.fn(() => chainable),
    in: vi.fn(() => chainable),
    emit: vi.fn(),
  };
}

vi.mock("../src/websocket/index.js", () => ({
  getIO: vi.fn(() => createMockIO()),
  initSocketServer: vi.fn(),
}));

// ─── Mock: Email service ────────────────────────────────────────────────────
vi.mock("../src/config/email.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock: Storage (S3) ────────────────────────────────────────────────────
vi.mock("../src/config/storage.js", () => ({
  deleteSpacesObject: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue("https://cdn.example.com/presigned"),
}));

// ─── Mock: Snowflake ID generator ──────────────────────────────────────────
let idCounter = 1;
vi.mock("../src/utils/snowflake.js", () => ({
  generateId: vi.fn(() => String(idCounter++)),
}));

// ─── Mock: Permission checking ─────────────────────────────────────────────
vi.mock("../src/utils/checkPermission.js", () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
  checkRoleHierarchy: vi.fn().mockResolvedValue(undefined),
  getEffectivePermissions: vi.fn().mockResolvedValue(~0n),
}));

// ─── Mock: Logger ─────────────────────────────────────────────────────────
vi.mock("../src/config/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

// ─── Mock: Voice Redis RPC ─────────────────────────────────────────────────
vi.mock("../src/websocket/voice.redis.js", () => ({
  rpcToSfu: vi.fn().mockResolvedValue({
    transportParams: { id: "transport-1" },
    routerRtpCapabilities: {},
    existingProducers: [],
  }),
}));

// ─── Reset counters before each test ────────────────────────────────────────
beforeEach(() => {
  idCounter = 1;
  vi.clearAllMocks();
  // Re-set $transaction default since clearAllMocks wipes it
  mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return arg(mockPrisma);
    return Promise.all(arg as Promise<unknown>[]);
  });
});
