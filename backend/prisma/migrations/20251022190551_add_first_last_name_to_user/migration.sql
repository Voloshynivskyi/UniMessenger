-- DropIndex
DROP INDEX "public"."TelegramAccount_userId_telegramId_key";

-- AlterTable
ALTER TABLE "TelegramAccount" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;
