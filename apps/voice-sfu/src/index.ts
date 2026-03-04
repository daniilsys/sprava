import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { createWorkers } from "./mediasoup/workers.js";
import { startCommandSubscriber } from "./redis/subscriber.js";

async function main() {
  console.log("[voice-sfu] Starting...");

  await createWorkers();
  startCommandSubscriber();

  console.log("[voice-sfu] Ready");
}

main().catch((err) => {
  console.error("[voice-sfu] Fatal error:", err);
  process.exit(1);
});
