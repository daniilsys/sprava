-- AddForeignKey
ALTER TABLE "ReadState" ADD CONSTRAINT "ReadState_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
