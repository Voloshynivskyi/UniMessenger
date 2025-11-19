-- DropForeignKey
ALTER TABLE "public"."TelegramMessageIndex" DROP CONSTRAINT "TelegramMessageIndex_accountId_fkey";

-- AlterTable
ALTER TABLE "TelegramMessageIndex" ADD COLUMN     "rawAccessHash" TEXT,
ADD COLUMN     "rawPeerId" TEXT,
ADD COLUMN     "rawPeerType" TEXT;

-- AddForeignKey
ALTER TABLE "TelegramMessageIndex" ADD CONSTRAINT "TelegramMessageIndex_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TelegramAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
