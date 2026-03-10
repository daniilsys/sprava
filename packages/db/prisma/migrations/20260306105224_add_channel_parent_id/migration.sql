-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "parentId" TEXT;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
