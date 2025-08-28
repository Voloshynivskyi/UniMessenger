// File: frontend/src/App.tsx
// Purpose: Layout + routes only (NO providers here).
// Notes:
// - Header/Sidebar use useTelegramAuth, but now they are inside providers from main.tsx.
// - Routes include /inbox/chat/:peerType/:peerId so opening chats from UnifiedInbox works.

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Header from './layouts/Header';
import Sidebar from './layouts/Sidebar';

import MainMenuPage from './pages/MainMenuPage';
import UnifiedInboxPage from './pages/UnifiedInboxPage';
import ChatPage from './pages/ChatPage';
import AccountsPage from './pages/AccountsPage';

// Optional tiny error boundary to avoid full crash on runtime errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-lg w-full border rounded-xl p-6 shadow">
            <h1 className="text-xl font-semibold mb-2">Упс! Щось пішло не так.</h1>
            <p className="text-sm opacity-80">
              Спробуйте перезавантажити сторінку або повернутись на головну.
            </p>
            <pre className="mt-3 text-xs overflow-auto max-h-40 bg-black/5 p-2 rounded">
              {String(this.state.error || '')}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <div className="w-screen h-screen overflow-hidden bg-gray-100">
        {/* Header uses useTelegramAuth -> safe because providers are in main.tsx */}
        <Header />
        <div className="flex h-[calc(100%-3rem)]">
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<MainMenuPage />} />
              <Route path="/inbox" element={<UnifiedInboxPage />} />
              {/* Critical route for opening chats */}
              <Route path="/inbox/chat/:peerType/:peerId" element={<ChatPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
