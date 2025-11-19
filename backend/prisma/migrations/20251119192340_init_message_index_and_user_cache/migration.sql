-- CreateTable
CREATE TABLE "TelegramMessageIndex" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TelegramMessageIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramUserCache" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "photoId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramUserCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramMessageIndex_accountId_messageId_key" ON "TelegramMessageIndex"("accountId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramUserCache_accountId_userId_key" ON "TelegramUserCache"("accountId", "userId");

-- AddForeignKey
ALTER TABLE "TelegramMessageIndex" ADD CONSTRAINT "TelegramMessageIndex_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TelegramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramUserCache" ADD CONSTRAINT "TelegramUserCache_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TelegramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
