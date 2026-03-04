// Re-export the shared Prisma client from @sprava/db.
// All other services (auth-gateway, voice-gateway, etc.) should import
// directly from "@sprava/db" rather than going through this shim.
export { prisma } from "@sprava/db";
