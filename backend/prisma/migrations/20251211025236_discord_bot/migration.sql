-- CreateTable
CREATE TABLE "DiscordBot" (
    "id" TEXT NOT NULL,
    "botToken" TEXT NOT NULL,
    "botUserId" TEXT,
    "botUsername" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordBot_pkey" PRIMARY KEY ("id")
);
