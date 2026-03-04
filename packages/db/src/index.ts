import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from monorepo root (packages/db/src/ → up 3 levels)
config({ path: resolve(__dirname, "../../../.env") });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "./generated/prisma/client/client.js";

export { Prisma };
export * from "./generated/prisma/client/client.js";

// DATABASE_URL should point to PgBouncer in production.
// Keep the pool small per-process since PgBouncer handles external pooling.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: Number(process.env.DB_POOL_MAX ?? "3"),
});

export const prisma = new PrismaClient({ adapter });
