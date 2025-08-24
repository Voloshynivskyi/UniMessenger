// File: frontend/src/App.tsx
// Main React app component, sets up routing and layout.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Header from './layouts/Header'
import Sidebar from './layouts/Sidebar'
import MainMenuPage      from './pages/MainMenuPage'
import AccountsPage      from './pages/AccountsPage'
import UnifiedInboxPage  from './pages/UnifiedInboxPage'
import ChatPage          from './pages/ChatPage' // 👈 new chat page

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col w-screen h-screen">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <Routes>
            {/* Main */}
            <Route path="/"            element={<MainMenuPage />} />
            {/* Inbox list */}
            <Route path="/inbox"       element={<UnifiedInboxPage />} />
            {/* Accounts (Telegram linking, etc.) */}
            <Route path="/accounts"    element={<AccountsPage />} />
            {/* Chat route: /inbox/chat/:peerType/:peerId */}
            <Route path="/inbox/chat/:peerType/:peerId" element={<ChatPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
