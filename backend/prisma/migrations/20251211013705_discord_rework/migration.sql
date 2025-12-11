/*
  Warnings:

  - You are about to drop the column `botToken` on the `DiscordAccount` table. All the data in the column will be lost.
  - You are about to drop the column `botUserId` on the `DiscordAccount` table. All the data in the column will be lost.
  - You are about to drop the column `botUsername` on the `DiscordAccount` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."DiscordAccount_botToken_key";

-- DropIndex
DROP INDEX "public"."DiscordAccount_userId_idx";

-- AlterTable
ALTER TABLE "DiscordAccount" DROP COLUMN "botToken",
DROP COLUMN "botUserId",
DROP COLUMN "botUsername";

-- CreateTable
CREATE TABLE "DiscordGuild" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordGuild_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscordGuild_accountId_guildId_key" ON "DiscordGuild"("accountId", "guildId");

-- AddForeignKey
ALTER TABLE "DiscordGuild" ADD CONSTRAINT "DiscordGuild_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DiscordAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
