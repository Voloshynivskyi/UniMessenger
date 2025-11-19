// services/telegram/telegramMessageIndexService.ts
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";

function normalizeId(id: any): string {
  if (!id) return "";
  return String(id);
}

export const TelegramMessageIndexService = {
  async addIndex(
    accountId: string,
    messageId: string,
    chatId: string,
    date?: Date,
    peerMeta?: {
      rawPeerType?: string;
      rawPeerId?: string;
      rawAccessHash?: string | null;
    }
  ) {
    const msgId = normalizeId(messageId);
    const cId = normalizeId(chatId);

    await prisma.telegramMessageIndex.upsert({
      where: {
        accountId_messageId: {
          accountId,
          messageId: msgId,
        },
      },
      update: {
        chatId,
        date: date || null,
        rawPeerType: peerMeta?.rawPeerType ?? null,
        rawPeerId: peerMeta?.rawPeerId ?? null,
        rawAccessHash: peerMeta?.rawAccessHash ?? null,
      },
      create: {
        accountId,
        messageId: msgId,
        chatId,
        date: date || null,
        rawPeerType: peerMeta?.rawPeerType ?? null,
        rawPeerId: peerMeta?.rawPeerId ?? null,
        rawAccessHash: peerMeta?.rawAccessHash ?? null,
      },
    });

    console.log(
      `[TelegramMessageIndexService] Indexed message ${msgId} in chat ${cId} for account ${accountId}`
    );
  },
  async markDeleted(accountId: string, messageIds: any | any[]) {
    const ids = (Array.isArray(messageIds) ? messageIds : [messageIds]).map(
      normalizeId
    );

    await prisma.telegramMessageIndex.updateMany({
      where: {
        accountId,
        messageId: { in: ids },
      },
      data: { deleted: true },
    });

    console.log(
      `[TelegramMessageIndexService] Marked deleted: ${ids.join(", ")}`
    );
  },
  async getRecord(accountId: string, messageId: string) {
    return prisma.telegramMessageIndex.findUnique({
      where: {
        accountId_messageId: {
          accountId,
          messageId,
        },
      },
    });
  },
};
