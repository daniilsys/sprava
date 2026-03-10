-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "isWorld" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserSettings" ALTER COLUMN "noiseCancellation" SET DEFAULT 'HIGH_QUALITY';

-- Backfill: create @world role for existing servers that don't have one
-- 225152 = VIEW_CHANNEL | READ_MESSAGES | POST_MESSAGES | VIEW_HISTORY | UPLOAD | REACT | JOIN_VOICE | SPEAK | GENERATE_INVITE
INSERT INTO "Role" (id, name, "serverId", permissions, position, "isWorld")
SELECT
  gen_random_uuid()::text,
  '@world',
  s.id,
  225152,
  0,
  true
FROM "Server" s
WHERE NOT EXISTS (
  SELECT 1 FROM "Role" r WHERE r."serverId" = s.id AND r."isWorld" = true
);
