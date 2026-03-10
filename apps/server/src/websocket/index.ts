import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Server as HttpServer } from "http";
import { redis } from "../config/redis.js";
import { socketAuthMiddleware } from "./socket.auth.js";
import { registerSocketHandlers } from "./socket.handlers.js";
import { startVoiceNotifySubscriber } from "./voice.notify.js";

let io: Server | undefined;

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? "*",
      methods: ["GET", "POST"],
    },
    pingInterval: 15_000, // server pings client every 15s
    pingTimeout: 10_000, // client has 10s to respond → offline in ~25s
    perMessageDeflate: {
      threshold: 1024, // only compress frames > 1 KB
      zlibDeflateOptions: { level: 6 },
      zlibInflateOptions: { chunkSize: 10 * 1024 },
    },
  });

  // Redis adapter for horizontal scaling — all instances share socket rooms
  const subClient = redis.duplicate();
  io.adapter(createAdapter(redis, subClient));

  // Flush stale presence data on startup — connected users re-register on reconnect
  flushPresence();

  io.use(socketAuthMiddleware);
  io.on("connection", (socket) => registerSocketHandlers(io!, socket));

  // Start the voice:notify subscriber once at boot
  startVoiceNotifySubscriber(io);

  return io;
}

/** Returns undefined if Socket.io hasn't been initialized (e.g. in tests). */
export function getIO(): Server | undefined {
  return io;
}

/** Remove all presence:server:* keys so stale "online" users are cleared. */
async function flushPresence(): Promise<void> {
  try {
    const keys = await redis.keys("presence:server:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Non-fatal — worst case stale presence persists until TTL
  }
}
