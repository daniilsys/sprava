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
  });

  // Redis adapter for horizontal scaling — all instances share socket rooms
  const subClient = redis.duplicate();
  io.adapter(createAdapter(redis, subClient));

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
