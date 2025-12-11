/*
  Warnings:

  - A unique constraint covering the columns `[botToken]` on the table `DiscordAccount` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[discordUserId]` on the table `DiscordAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DiscordAccount" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "discordUserId" TEXT,
ADD COLUMN     "discordUsername" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ALTER COLUMN "botToken" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DiscordAccount_botToken_key" ON "DiscordAccount"("botToken");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordAccount_discordUserId_key" ON "DiscordAccount"("discordUserId");

-- CreateIndex
CREATE INDEX "DiscordAccount_userId_idx" ON "DiscordAccount"("userId");
