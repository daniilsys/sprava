import { createServer } from "http";
import { app } from "./app.js";
import { initSocketServer } from "./websocket/index.js";
import { prisma } from "./config/db.js";
import { redis } from "./config/redis.js";
import { logger } from "./config/logger.js";

const PORT = process.env.PORT ?? 3000;

const httpServer = createServer(app);
const io = initSocketServer(httpServer);

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, "Server running");
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully");

  // 1. Stop accepting new connections
  httpServer.close();

  // 2. Close WebSocket connections
  io.close();

  // 3. Disconnect data stores
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);

  logger.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
