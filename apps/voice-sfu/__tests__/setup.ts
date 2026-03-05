import { vi, beforeEach } from "vitest";

// ─── Mock mediasoup ──────────────────────────────────────────────────────────

const mockProducer = {
  id: "producer-1",
  kind: "audio" as const,
  rtpParameters: { codecs: [], headerExtensions: [], encodings: [], rtcp: {} },
  close: vi.fn(),
};

const mockConsumer = {
  id: "consumer-1",
  kind: "audio" as const,
  producerId: "producer-1",
  rtpParameters: { codecs: [], headerExtensions: [], encodings: [], rtcp: {} },
  close: vi.fn(),
};

const mockTransport = {
  id: "transport-1",
  iceParameters: { usernameFragment: "u", password: "p", iceLite: true },
  iceCandidates: [],
  dtlsParameters: { fingerprints: [], role: "auto" },
  connect: vi.fn(),
  produce: vi.fn().mockResolvedValue(mockProducer),
  consume: vi.fn().mockResolvedValue(mockConsumer),
  close: vi.fn(),
};

const mockRouter = {
  id: "router-1",
  rtpCapabilities: { codecs: [], headerExtensions: [] },
  createWebRtcTransport: vi.fn().mockResolvedValue(mockTransport),
  canConsume: vi.fn().mockReturnValue(true),
  close: vi.fn(),
};

const mockWorker = {
  pid: 1234,
  createRouter: vi.fn().mockResolvedValue(mockRouter),
  on: vi.fn(),
  close: vi.fn(),
};

vi.mock("mediasoup", () => ({
  createWorker: vi.fn().mockResolvedValue(mockWorker),
}));

// ─── Mock ioredis ────────────────────────────────────────────────────────────

vi.mock("ioredis", () => {
  const RedisMock = vi.fn(() => ({
    publish: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn((_channel: string, cb?: (err: Error | null) => void) => {
      if (cb) cb(null);
    }),
    on: vi.fn(),
    quit: vi.fn(),
  }));
  return { default: RedisMock };
});

// ─── Mock dotenv ─────────────────────────────────────────────────────────────

vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

// ─── Clean state between tests ──────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Reset mock return values to defaults after clearAllMocks
  mockTransport.produce.mockResolvedValue(mockProducer);
  mockTransport.consume.mockResolvedValue(mockConsumer);
  mockRouter.createWebRtcTransport.mockResolvedValue(mockTransport);
  mockRouter.canConsume.mockReturnValue(true);
  mockWorker.createRouter.mockResolvedValue(mockRouter);
});

// Export mocks for direct use in tests
export { mockWorker, mockRouter, mockTransport, mockProducer, mockConsumer };
