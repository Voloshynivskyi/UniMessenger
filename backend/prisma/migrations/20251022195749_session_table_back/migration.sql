/*
  Warnings:

  - You are about to drop the column `sessionString` on the `TelegramAccount` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TelegramAccount" DROP COLUMN "sessionString";

-- CreateTable
CREATE TABLE "TelegramSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sessionString" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramSession_accountId_key" ON "TelegramSession"("accountId");

-- AddForeignKey
ALTER TABLE "TelegramSession" ADD CONSTRAINT "TelegramSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TelegramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
