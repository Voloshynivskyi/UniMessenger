/*
  Warnings:

  - You are about to drop the `TelegramSession` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[telegramId]` on the table `TelegramAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."TelegramSession" DROP CONSTRAINT "TelegramSession_accountId_fkey";

-- AlterTable
ALTER TABLE "TelegramAccount" ADD COLUMN     "sessionString" TEXT;

-- DropTable
DROP TABLE "public"."TelegramSession";

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccount_telegramId_key" ON "TelegramAccount"("telegramId");
