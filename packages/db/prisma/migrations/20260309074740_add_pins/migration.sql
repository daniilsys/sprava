-- CreateTable
CREATE TABLE "Pin" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "channelId" TEXT,
    "dmConversationId" TEXT,
    "pinnedById" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pin_channelId_idx" ON "Pin"("channelId");

-- CreateIndex
CREATE INDEX "Pin_dmConversationId_idx" ON "Pin"("dmConversationId");

-- CreateIndex
CREATE UNIQUE INDEX "Pin_messageId_key" ON "Pin"("messageId");

-- AddForeignKey
ALTER TABLE "Pin" ADD CONSTRAINT "Pin_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pin" ADD CONSTRAINT "Pin_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pin" ADD CONSTRAINT "Pin_dmConversationId_fkey" FOREIGN KEY ("dmConversationId") REFERENCES "DmConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pin" ADD CONSTRAINT "Pin_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
