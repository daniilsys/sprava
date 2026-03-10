import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { createWorkers, getAllWorkers } from "./mediasoup/workers.js";
import { startCommandSubscriber, stopCommandSubscriber } from "./redis/subscriber.js";
import { closePublisher } from "./redis/publisher.js";

async function main() {
  console.log("[voice-sfu] Starting...");

  await createWorkers();
  startCommandSubscriber();

  console.log("[voice-sfu] Ready");
}

// ─── Graceful shutdown ───────────────────────────────────────────────────────

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[voice-sfu] ${signal} received — shutting down...`);

  // 1. Stop accepting new commands
  await stopCommandSubscriber().catch(() => {});

  // 2. Close all mediasoup workers (closes all routers, transports, producers, consumers)
  const workers = getAllWorkers();
  for (const worker of workers) {
    worker.close();
  }
  console.log(`[voice-sfu] Closed ${workers.length} worker(s)`);

  // 3. Close Redis publisher
  await closePublisher().catch(() => {});

  console.log("[voice-sfu] Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((err) => {
  console.error("[voice-sfu] Fatal error:", err);
  process.exit(1);
});
