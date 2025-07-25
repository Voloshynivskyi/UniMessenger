// src/layouts/Sidebar.tsx
import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  FaTachometerAlt,
  FaInbox,
  FaThList,
  FaPenFancy,
  FaBell,
  FaUserCog,
  FaCog
} from 'react-icons/fa'

const menuItems = [
  { name: 'Dashboard',    path: '/',           icon: <FaTachometerAlt /> },
  { name: 'Unified Inbox',path: '/inbox',      icon: <FaInbox /> },
  { name: 'Channels',     path: '/channels',   icon: <FaThList /> },
  { name: 'Compose',      path: '/compose',    icon: <FaPenFancy /> },
  { name: 'Notifications',path: '/notifications',icon: <FaBell /> },
  { name: 'Accounts',     path: '/accounts',   icon: <FaUserCog /> },
  { name: 'Settings',     path: '/settings',   icon: <FaCog /> },
]

export default function Sidebar() {
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
  )
}
