-- CreateEnum
CREATE TYPE "ScheduledPostStatus" AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "ScheduledTargetStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "ScheduledPlatform" AS ENUM ('telegram', 'discord');

-- CreateTable
CREATE TABLE "ScheduledPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledPostStatus" NOT NULL DEFAULT 'scheduled',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledPostTarget" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "platform" "ScheduledPlatform" NOT NULL,
    "status" "ScheduledTargetStatus" NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "telegramAccountId" TEXT,
    "peerType" TEXT,
    "peerId" TEXT,
    "accessHash" TEXT,
    "discordBotId" TEXT,
    "channelId" TEXT,
    "threadId" TEXT,

    CONSTRAINT "ScheduledPostTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledPost_userId_idx" ON "ScheduledPost"("userId");

-- CreateIndex
CREATE INDEX "ScheduledPost_scheduledAt_idx" ON "ScheduledPost"("scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledPostTarget_postId_idx" ON "ScheduledPostTarget"("postId");

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPostTarget" ADD CONSTRAINT "ScheduledPostTarget_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ScheduledPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
