/*
  Warnings:

  - A unique constraint covering the columns `[botToken]` on the table `DiscordBot` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[botUserId]` on the table `DiscordBot` will be added. If there are existing duplicate values, this will fail.
  - Made the column `botUserId` on table `DiscordBot` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "DiscordBot" ALTER COLUMN "botUserId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DiscordBot_botToken_key" ON "DiscordBot"("botToken");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordBot_botUserId_key" ON "DiscordBot"("botUserId");
