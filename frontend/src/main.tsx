import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { TelegramAuthProvider } from './context/TelegramAuthContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Remove StrictMode in dev to avoid double effects that rapidly open/close WS
  <TelegramAuthProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </TelegramAuthProvider>
);
