/*
  Warnings:

  - You are about to drop the `DiscordAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DiscordGuild` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `userId` to the `DiscordBot` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."DiscordAccount" DROP CONSTRAINT "DiscordAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DiscordGuild" DROP CONSTRAINT "DiscordGuild_accountId_fkey";

-- AlterTable
ALTER TABLE "DiscordBot" ADD COLUMN     "userId" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."DiscordAccount";

-- DropTable
DROP TABLE "public"."DiscordGuild";

-- CreateTable
CREATE TABLE "DiscordBotGuild" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordBotGuild_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscordBotGuild_botId_guildId_key" ON "DiscordBotGuild"("botId", "guildId");

-- CreateIndex
CREATE INDEX "DiscordBot_userId_idx" ON "DiscordBot"("userId");

-- AddForeignKey
ALTER TABLE "DiscordBot" ADD CONSTRAINT "DiscordBot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordBotGuild" ADD CONSTRAINT "DiscordBotGuild_botId_fkey" FOREIGN KEY ("botId") REFERENCES "DiscordBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
