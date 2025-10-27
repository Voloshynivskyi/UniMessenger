// frontend/src/components/inbox/ChatList.tsx
import { List } from "@mui/material";
import type UnifiedChat from "./types/UnifiedChat";
import ChatListItem from "./ChatListItem";
export interface ChatListProps {
  chats: UnifiedChat[];
}

const ChatList: React.FC<ChatListProps> = ({ chats }) => {
  const renderedChats = chats.map((chat) => (
    <ChatListItem key={`${chat.platform}-${chat.id}`} chat={chat} />
  ));

  return <List>{renderedChats}</List>;
};

export default ChatList;
