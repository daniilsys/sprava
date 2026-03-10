import { vi, beforeEach } from "vitest";

// ─── Mock mediasoup ──────────────────────────────────────────────────────────

const mockProducer = {
  id: "producer-1",
  kind: "audio" as const,
  rtpParameters: { codecs: [], headerExtensions: [], encodings: [], rtcp: {} },
  close: vi.fn(),
  on: vi.fn(),
};

const mockConsumer = {
  id: "consumer-1",
  kind: "audio" as const,
  type: "simple" as const,
  producerId: "producer-1",
  rtpParameters: { codecs: [], headerExtensions: [], encodings: [], rtcp: {} },
  paused: false,
  close: vi.fn(),
  on: vi.fn(),
  resume: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn().mockResolvedValue(undefined),
  setPreferredLayers: vi.fn().mockResolvedValue(undefined),
};

const mockSendTransport = {
  id: "send-transport-1",
  iceParameters: { usernameFragment: "u", password: "p", iceLite: true },
  iceCandidates: [],
  dtlsParameters: { fingerprints: [], role: "auto" },
  connect: vi.fn(),
  produce: vi.fn().mockResolvedValue(mockProducer),
  consume: vi.fn().mockResolvedValue(mockConsumer),
  close: vi.fn(),
  setMaxIncomingBitrate: vi.fn().mockResolvedValue(undefined),
};

const mockRecvTransport = {
  id: "recv-transport-1",
  iceParameters: { usernameFragment: "u2", password: "p2", iceLite: true },
  iceCandidates: [],
  dtlsParameters: { fingerprints: [], role: "auto" },
  connect: vi.fn(),
  produce: vi.fn().mockResolvedValue(mockProducer),
  consume: vi.fn().mockResolvedValue(mockConsumer),
  close: vi.fn(),
  setMaxIncomingBitrate: vi.fn().mockResolvedValue(undefined),
};

// Legacy alias for tests that reference mockTransport
const mockTransport = mockSendTransport;

let transportCallCount = 0;

const mockSpeakerObserver = {
  on: vi.fn(),
  close: vi.fn(),
  closed: false,
  addProducer: vi.fn().mockResolvedValue(undefined),
};

const mockRouter = {
  id: "router-1",
  rtpCapabilities: { codecs: [], headerExtensions: [] },
  createWebRtcTransport: vi.fn().mockImplementation(() => {
    transportCallCount++;
    return Promise.resolve(transportCallCount % 2 === 1 ? mockSendTransport : mockRecvTransport);
  }),
  createActiveSpeakerObserver: vi.fn().mockResolvedValue(mockSpeakerObserver),
  canConsume: vi.fn().mockReturnValue(true),
  close: vi.fn(),
};

const mockWorker = {
  pid: 1234,
  closed: false,
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
    disconnect: vi.fn(),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
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
  transportCallCount = 0;

  // Reset mock return values to defaults after clearAllMocks
  mockProducer.on.mockImplementation(() => {});
  mockConsumer.on.mockImplementation(() => {});
  mockConsumer.resume.mockResolvedValue(undefined);
  mockConsumer.pause.mockResolvedValue(undefined);
  mockConsumer.setPreferredLayers.mockResolvedValue(undefined);
  mockConsumer.paused = false;
  mockSendTransport.produce.mockResolvedValue(mockProducer);
  mockSendTransport.setMaxIncomingBitrate.mockResolvedValue(undefined);
  mockRecvTransport.consume.mockResolvedValue(mockConsumer);
  mockRecvTransport.setMaxIncomingBitrate.mockResolvedValue(undefined);
  mockRouter.createWebRtcTransport.mockImplementation(() => {
    transportCallCount++;
    return Promise.resolve(transportCallCount % 2 === 1 ? mockSendTransport : mockRecvTransport);
  });
  mockRouter.createActiveSpeakerObserver.mockResolvedValue(mockSpeakerObserver);
  mockRouter.canConsume.mockReturnValue(true);
  mockWorker.createRouter.mockResolvedValue(mockRouter);
  mockWorker.closed = false;
  mockSpeakerObserver.closed = false;
});

// Export mocks for direct use in tests
export {
  mockWorker,
  mockRouter,
  mockTransport,
  mockSendTransport,
  mockRecvTransport,
  mockProducer,
  mockConsumer,
  mockSpeakerObserver,
};
