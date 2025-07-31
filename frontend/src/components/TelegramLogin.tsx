import React, { useState, useRef, useEffect } from 'react';
import { useTelegramAuth } from '../context/TelegramAuthContext';

const TelegramLogin: React.FC = () => {
  const { status, username, sendLoginCode, confirmCode, error, signOut } = useTelegramAuth();

  const [phone, setPhone] = useState('+380');
  const [code, setCode] = useState('');
  const [pass, setPass] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ((status === 'sent' || status === '2fa') && codeRef.current) {
      codeRef.current.focus();
    }
  }, [status]);

  if (status === 'authorized') {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <h2 className="text-2xl mb-4">Login Successful</h2>
          <p className="text-lg text-green-600 mb-4">@{username}</p>
          <button onClick={signOut} className="px-4 py-2 bg-red-500 text-white rounded-lg">
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
        <h2 className="text-2xl text-center">Login with Telegram</h2>

        {status === 'idle' && (
          <>
            <input
              className="w-full p-3 border rounded-lg"
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone number"
            />
            <button onClick={() => sendLoginCode(phone)} className="w-full bg-blue-500 text-white p-3 rounded-lg">
              Send Code
            </button>
          </>
        )}

        {(status === 'sent' || status === '2fa') && (
          <>
            <input
              ref={codeRef}
              className="w-full p-3 border rounded-lg"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Enter code"
            />
            <input
              className="w-full p-3 border rounded-lg"
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="2FA password (if any)"
            />
            <button onClick={() => confirmCode(code, pass)} className="w-full bg-green-500 text-white p-3 rounded-lg">
              Confirm Code
            </button>
          </>
        )}

        {status === 'loading' && <p className="text-center">Loading…</p>}
        {error && <p className="text-center text-red-600">❌ {error}</p>}
      </div>
    </div>
  );
};

export default TelegramLogin;
