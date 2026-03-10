-- CreateEnum
CREATE TYPE "NoiseCancellation" AS ENUM ('OFF', 'LIGHT', 'HIGH_QUALITY');

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "noiseCancellation" "NoiseCancellation" NOT NULL DEFAULT 'LIGHT';
