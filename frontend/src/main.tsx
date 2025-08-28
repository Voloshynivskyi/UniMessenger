// File: frontend/src/main.tsx
// Purpose: App bootstrap + providers + cookie-less session bootstrap.
// Change: read several possible storage keys for session id.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './index.css';

import { TelegramAuthProvider } from './context/TelegramAuthContext';
import { SocketProvider } from './context/SocketProvider';
import { setDefaultSessionId } from './lib/http';

(function bootstrapSessionId() {
  const url = new URL(window.location.href);
  const fromUrl =
    url.searchParams.get('session') ||
    url.searchParams.get('sessionId') ||
    url.searchParams.get('s');

  // Try a few likely keys (in case earlier code used a different name)
  const keys = [
    'tg_active_session',
    'activeSessionId',
    'telegram_active_session',
    'unimessenger_active_session',
  ];
  let fromStorage: string | null = null;
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) { fromStorage = v; break; }
  }

  const sid = (fromUrl || fromStorage || '').trim();
  setDefaultSessionId(sid || null);
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TelegramAuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SocketProvider>
    </TelegramAuthProvider>
  </React.StrictMode>
);
