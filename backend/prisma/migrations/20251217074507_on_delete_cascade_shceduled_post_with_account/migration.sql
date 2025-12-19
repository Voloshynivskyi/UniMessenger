-- DropForeignKey
ALTER TABLE "public"."TelegramMessageIndex" DROP CONSTRAINT "TelegramMessageIndex_accountId_fkey";

-- AddForeignKey
ALTER TABLE "TelegramMessageIndex" ADD CONSTRAINT "TelegramMessageIndex_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TelegramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPostTarget" ADD CONSTRAINT "ScheduledPostTarget_telegramAccountId_fkey" FOREIGN KEY ("telegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
