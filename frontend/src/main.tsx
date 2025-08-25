// File: frontend/src/main.tsx
// Purpose: Entry point for React app, sets up Router and AuthProvider.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { TelegramAuthProvider } from './context/TelegramAuthContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TelegramAuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </TelegramAuthProvider>
  </React.StrictMode>
);
