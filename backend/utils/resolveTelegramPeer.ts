// backend/utils/resolveTelegramPeer.ts
import { Api } from "telegram";
import bigInt, { type BigInteger } from "big-integer";

/**
 * Safely creates a correct InputPeer object for Telegram API calls.
 * Handles all peer types: user, chat, channel.
 */
export function resolveTelegramPeer(
  peerType: "user" | "chat" | "channel",
  id: string | number | bigint,
  accessHash?: string | number | bigint | null
): Api.TypeInputPeer {
  // Ensure all IDs are converted to valid BigInteger
  const idBigInt: BigInteger = bigInt(String(id));

  // Safely handle possible undefined/null accessHash
  const hashValue =
    accessHash !== null && accessHash !== undefined ? String(accessHash) : "0";

  const hashBigInt: BigInteger = bigInt(hashValue);

  switch (peerType) {
    case "user":
      return new Api.InputPeerUser({
        userId: idBigInt,
        accessHash: hashBigInt,
      });

    case "channel":
      return new Api.InputPeerChannel({
        channelId: idBigInt,
        accessHash: hashBigInt,
      });

    case "chat":
    default:
      return new Api.InputPeerChat({
        chatId: idBigInt,
      });
  }
}
