// Purpose: Accounts manager, list/add/remove Telegram accounts.

import React, { useState } from 'react';
import TelegramLogin from '../components/TelegramLogin';
import { useTelegramAuth } from '../context/TelegramAuthContext';

const AccountsPage: React.FC = () => {
  const { accounts, addAccount, removeAccount, clearAll } = useTelegramAuth();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-6 flex-1 overflow-auto space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Accounts</h1>
          <button
            onClick={() => setAdding(v => !v)}
            className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            {adding ? 'Cancel' : 'Add Telegram Account'}
          </button>
          {accounts.length > 0 && (
            <button
              onClick={clearAll}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              title="Remove all connected accounts"
            >
              Remove all
            </button>
          )}
        </div>

        {adding && (
          <TelegramLogin
            onSuccess={(acc) => {
              addAccount({ sessionId: acc.sessionId, username: acc.username ?? null });
              setAdding(false);
            }}
          />
        )}

        <div className="space-y-3">
          {accounts.length === 0 ? (
            <div className="text-gray-600">No connected Telegram accounts yet.</div>
          ) : (
            accounts.map((a) => (
              <div
                key={a.sessionId}
                className="flex items-center justify-between p-4 bg-white rounded-lg shadow"
              >
                <div>
                  <div className="font-semibold">
                    {a.username ? `@${a.username}` : '(unknown username)'}
                  </div>
                  <div className="text-xs text-gray-500 break-all">{a.sessionId}</div>
                </div>
                <button
                  onClick={() => removeAccount(a.sessionId)}
                  className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountsPage;

