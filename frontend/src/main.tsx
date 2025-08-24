// File: frontend/src/main.tsx
// Entry point for React frontend, renders the app and provides Telegram auth context.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TelegramAuthProvider } from './context/TelegramAuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TelegramAuthProvider>
      <App />
    </TelegramAuthProvider>
  </React.StrictMode>
);
