import os from "os";
import { createWorker } from "mediasoup";
import type { Worker } from "mediasoup/types";

const workers: Worker[] = [];
let nextWorkerIndex = 0;

const RTC_MIN_PORT = Number(process.env.RTC_MIN_PORT ?? 10000);
const RTC_MAX_PORT = Number(process.env.RTC_MAX_PORT ?? 10999);

/**
 * Creates one mediasoup Worker per logical CPU core.
 * Must be called once at startup before any routing begins.
 */
export async function createWorkers(): Promise<void> {
  const numCores = os.cpus().length;
  console.log(`[workers] Creating ${numCores} mediasoup worker(s) (ports ${RTC_MIN_PORT}-${RTC_MAX_PORT})`);

  for (let i = 0; i < numCores; i++) {
    await spawnWorker(i);
  }
}

async function spawnWorker(index: number): Promise<void> {
  const worker = await createWorker({
    logLevel: "warn",
    rtcMinPort: RTC_MIN_PORT,
    rtcMaxPort: RTC_MAX_PORT,
  });

  worker.on("died", (err) => {
    console.error(`[workers] Worker ${worker.pid} died:`, err);
    workers[index] = undefined as unknown as Worker;

    // Auto-restart after a short delay
    setTimeout(async () => {
      console.log(`[workers] Restarting worker at index ${index}...`);
      try {
        await spawnWorker(index);
        console.log(`[workers] Worker ${workers[index].pid} restarted at index ${index}`);
      } catch (restartErr) {
        console.error(`[workers] Failed to restart worker at index ${index}:`, restartErr);
      }
    }, 2000);
  });

  workers[index] = worker;
  console.log(`[workers] Worker ${worker.pid} ready (index ${index})`);
}

/** Returns the next Worker via round-robin, skipping dead workers. */
export function getNextWorker(): Worker {
  if (workers.length === 0) throw new Error("Workers not initialized");

  const startIndex = nextWorkerIndex;
  do {
    const worker = workers[nextWorkerIndex];
    nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
    if (worker && !worker.closed) return worker;
  } while (nextWorkerIndex !== startIndex);

  throw new Error("All workers are dead");
}

/** Returns all living workers (for graceful shutdown). */
export function getAllWorkers(): Worker[] {
  return workers.filter((w) => w && !w.closed);
}
