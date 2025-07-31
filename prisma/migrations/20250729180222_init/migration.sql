-- CreateTable
CREATE TABLE "public"."Account" (
    "id" SERIAL NOT NULL,
    "platform" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Channel" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "platformId" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" SERIAL NOT NULL,
    "channelId" INTEGER NOT NULL,
    "text" TEXT,
    "mediaUrl" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Channel" ADD CONSTRAINT "Channel_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
