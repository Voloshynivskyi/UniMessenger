// File: frontend/src/components/TelegramLogin.tsx
// Purpose: Standalone login widget for a new Telegram account.

import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sendCode, authenticate } from '../api/telegramAuth';

type Props = {
  onSuccess: (acc: { sessionId: string; username: string | null }) => void;
};

type Stage = 'idle' | 'code_sent' | 'twofa' | 'loading' | 'done' | 'error';

const TelegramLogin: React.FC<Props> = ({ onSuccess }) => {
  const [stage, setStage] = useState<Stage>('idle');
  const [phone, setPhone] = useState('+48');
  const [code, setCode] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [sessionId] = useState<string>(() => uuidv4());
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ((stage === 'code_sent' || stage === 'twofa') && codeRef.current) codeRef.current.focus();
  }, [stage]);

  async function handleSendCode() {
    setError(null);
    setStage('loading');
    try {
      await sendCode(phone, sessionId);
      setStage('code_sent');
    } catch (e: any) {
      setError(e?.message || 'Failed to send code');
      setStage('error');
    }
  }

  async function handleConfirm() {
    setError(null);
    setStage('loading');
    try {
      const res = await authenticate({
        phoneNumber: phone,
        sessionId,
        code,
        password: pass,
      });
      if (res.status === 'AUTHORIZED') {
        const sid = res.session || sessionId;
        const username = res.username ?? null;
        setStage('done');
        onSuccess({ sessionId: sid, username });
      } else {
        setStage('twofa');
      }
    } catch (e: any) {
      setError(e?.message || 'Authentication failed');
      setStage('error');
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <h3 className="text-xl font-semibold text-center">Add Telegram Account</h3>

      {(stage === 'idle' || stage === 'error') && (
        <>
          <input
            className="w-full p-3 border rounded-lg"
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Phone number"
          />
          <button
            onClick={handleSendCode}
            className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600"
          >
            Send Code
          </button>
          {error && <p className="text-center text-red-600">❌ {error}</p>}
        </>
      )}

      {(stage === 'code_sent' || stage === 'twofa' || stage === 'loading') && (
        <>
          <input
            ref={codeRef}
            className="w-full p-3 border rounded-lg"
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Enter code from Telegram"
          />
          <input
            className="w-full p-3 border rounded-lg"
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            placeholder="2FA password (if any)"
          />
          <button
            onClick={handleConfirm}
            disabled={stage === 'loading'}
            className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 disabled:opacity-60"
          >
            Confirm
          </button>
          {stage === 'loading' && <p className="text-center">Loading...</p>}
          {error && <p className="text-center text-red-600">❌ {error}</p>}
        </>
      )}
    </div>
  );
};

export default TelegramLogin;

