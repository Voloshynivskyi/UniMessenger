export default interface UnifiedChat {
  id: string;
  platform: "telegram" | "discord" | "slack";
  title: string;
  lastMessage: string;
  lastMessageDate: string;
  unreadCount?: number;
  pinned?: boolean;
}
