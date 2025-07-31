// src/pages/AccountsPage.tsx
import React from 'react';
import { useTelegramAuth } from '../context/TelegramAuthContext';
import TelegramLogin from '../components/TelegramLogin';

const AccountsPage: React.FC = () => {
  // Access auth status and actions from context
  const { status, username, signOut, error } = useTelegramAuth();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-6 flex-1 overflow-auto">
        <h1 className="text-2xl font-bold mb-4">🔐 Telegram Account Login</h1>

        {status === 'loading' && (
          <p className="text-center">Loading…</p>
        )}

        {status === 'authorized' && username && (
          <div className="h-full flex items-center justify-center">
            <div className="bg-green-50 border border-green-200 text-green-800 p-6 rounded-lg w-full max-w-md mx-auto text-center">
              <p className="mb-2">You are logged in!</p>
              <p className="mb-4 text-lg font-medium">@{username}</p>
              <button
                onClick={signOut}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {(status === 'idle' || status === 'sent' || status === '2fa') && (
          <div className="h-full">
            <TelegramLogin />
            {error && (
              <div className="mt-4 text-red-600 text-center">
                ❌ Error: {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountsPage;