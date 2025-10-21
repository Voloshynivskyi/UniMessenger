/*
  Warnings:

  - A unique constraint covering the columns `[userId,telegramId]` on the table `TelegramAccount` will be added. If there are existing duplicate values, this will fail.
  - Made the column `telegramId` on table `TelegramAccount` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "TelegramAccount" ALTER COLUMN "telegramId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccount_userId_telegramId_key" ON "TelegramAccount"("userId", "telegramId");
