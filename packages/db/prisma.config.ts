import { config } from "dotenv";
config({ path: "../../.env" });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Migrations need a direct connection to PostgreSQL — not through PgBouncer.
    // Set DATABASE_DIRECT_URL to the PostgreSQL URL in production.
    // Falls back to DATABASE_URL for local dev (where PgBouncer may not be running).
    url: process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
