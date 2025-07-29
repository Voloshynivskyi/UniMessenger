// src/pages/AccountsPage.tsx
import React from 'react';
import { useTelegramAuth } from '../context/TelegramAuthContext';
import TelegramLogin from '../components/TelegramLogin';

const AccountsPage: React.FC = () => {
  const { session, status, error } = useTelegramAuth();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-6 flex-1 overflow-auto">
        <h1 className="text-2xl font-bold mb-4">🔐 Telegram Account Login</h1>

        {status === 'authorized' && session ? (
          <div className="h-full flex items-center justify-center">
            <div className="bg-green-50 border border-green-200 text-green-800 p-6 rounded-lg w-full max-w-md mx-auto text-center">
              <p className="mb-2">You are logged in!</p>
              <code className="break-all block bg-white p-2 rounded">{session}</code>
            </div>
          </div>
        ) : (
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
