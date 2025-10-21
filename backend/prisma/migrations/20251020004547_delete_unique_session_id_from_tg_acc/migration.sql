/*
  Warnings:

  - You are about to drop the column `sessionId` on the `TelegramAccount` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."TelegramAccount_sessionId_key";

-- AlterTable
ALTER TABLE "TelegramAccount" DROP COLUMN "sessionId";
