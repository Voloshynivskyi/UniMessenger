// src/layouts/Sidebar.tsx
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaInbox,
  FaThList,
  FaPenFancy,
  FaBell,
  FaUserCog,
  FaCog
} from 'react-icons/fa';
import { useTelegramAuth } from '../context/TelegramAuthContext';
import { fetchChatPreviews } from '../api/telegramChats';

const menuItemsBase = [
  { name: 'Dashboard',    path: '/',           icon: <FaTachometerAlt /> },
  { name: 'Unified Inbox',path: '/inbox',      icon: <FaInbox /> },
  { name: 'Channels',     path: '/channels',   icon: <FaThList /> },
  { name: 'Compose',      path: '/compose',    icon: <FaPenFancy /> },
  { name: 'Notifications',path: '/notifications',icon: <FaBell /> },
  { name: 'Accounts',     path: '/accounts',   icon: <FaUserCog /> },
  { name: 'Settings',     path: '/settings',   icon: <FaCog /> },
];

export default function Sidebar() {
  const { sessionId, authorized } = useTelegramAuth();
  const [unreadTotal, setUnreadTotal] = useState<number>(0);

  useEffect(() => {
    if (authorized && sessionId) {
      fetchChatPreviews(sessionId, 50)
        .then(chats => {
          const total = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
          setUnreadTotal(total);
        })
        .catch(() => setUnreadTotal(0));
    }
  }, [authorized, sessionId]);

  const menuItems = menuItemsBase.map(item => {
    if (item.name === 'Unified Inbox' && unreadTotal > 0) {
      return { ...item, name: `${item.name} (${unreadTotal})` };
    }
    return item;
  });

  return (
    <aside className="w-64 h-full bg-white border-r">
      <nav className="mt-4">
        {menuItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-2 my-1 rounded hover:bg-gray-100 transition ${
                isActive ? 'bg-gray-200 font-semibold' : 'text-gray-700'
              }`
            }
          >
            <span className="mr-3">{item.icon}</span>
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
