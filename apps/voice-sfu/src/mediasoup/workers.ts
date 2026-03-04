import os from "os";
import { createWorker } from "mediasoup";
import type { Worker } from "mediasoup/types";

const workers: Worker[] = [];
let nextWorkerIndex = 0;

/**
 * Creates one mediasoup Worker per logical CPU core.
 * Must be called once at startup before any routing begins.
 */
export async function createWorkers(): Promise<void> {
  const numCores = os.cpus().length;
  console.log(`[workers] Creating ${numCores} mediasoup worker(s)`);

  for (let i = 0; i < numCores; i++) {
    const worker = await createWorker({
      logLevel: "warn",
      rtcMinPort: Number(process.env.RTC_MIN_PORT ?? 10000),
      rtcMaxPort: Number(process.env.RTC_MAX_PORT ?? 59999),
    });

    worker.on("died", (err) => {
      console.error(`[workers] Worker ${worker.pid} died:`, err);
      // In production you'd restart; here we just log
    });

    workers.push(worker);
    console.log(`[workers] Worker ${worker.pid} ready`);
  }
}

/** Returns the next Worker via round-robin. */
export function getNextWorker(): Worker {
  if (workers.length === 0) throw new Error("Workers not initialized");
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}
