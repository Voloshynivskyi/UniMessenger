// File: frontend/src/App.tsx
// Purpose: Main React app component, sets up layout and routes.

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './layouts/Header';
import Sidebar from './layouts/Sidebar';
import AccountsPage from './pages/AccountsPage';
import UnifiedInboxPage from './pages/UnifiedInboxPage';
import ChatPage from './pages/ChatPage';
import MainMenuPage from './pages/MainMenuPage';

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-100">
      <Header />
      <div className="flex h-[calc(100%-3rem)]">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<MainMenuPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/inbox" element={<UnifiedInboxPage />} />
            <Route path="/inbox/chat/:peerType/:peerId" element={<ChatPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default App;
