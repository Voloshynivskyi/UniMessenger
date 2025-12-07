// backend/utils/telegramPeerToChatId.ts
import { Api } from "telegram";

export function telegramPeerToChatId(
  peer: Api.TypePeer | undefined
): string | null {
  if (!peer) return null;

  if (peer instanceof Api.PeerUser) return String(peer.userId);
  if (peer instanceof Api.PeerChat) return String(peer.chatId);
  if (peer instanceof Api.PeerChannel) return String(peer.channelId);

  return null;
}
