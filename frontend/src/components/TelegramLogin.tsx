// src/components/TelegramLogin.tsx
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sendCode, authenticate } from '../api/telegramAuth';
import type { AuthResponse } from '../api/telegramAuth';

const TelegramLogin: React.FC = () => {
  const [sessionId] = useState(() => uuidv4());
  const [step, setStep] = useState<'phone' | 'code' | 'success'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('+380');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'code' && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [step]);

  const handleSendCode = async () => {
    setStatusMessage('Sending code…');
    try {
      await sendCode(phoneNumber, sessionId);
      setStep('code');
      setStatusMessage('📨 Code sent. Please enter it below.');
    } catch (err: any) {
      setStatusMessage(`❌ Error: ${err.message}`);
    }
  };

  const handleConfirm = async () => {
    setStatusMessage('Verifying code…');
    try {
      const res = (await authenticate({
        phoneNumber,
        sessionId,
        code: code.trim(),
        password: password.trim() || undefined,
      })) as AuthResponse;

      if (res.status === 'AUTHORIZED') {
        setUsername(res.username ?? null);
        setStatusMessage(`✅ Welcome, @${res.username}!`);
        setStep('success');
      } else {
        setStatusMessage('🔒 Two-factor password required. Please enter it.');
      }
    } catch (err: any) {
      setStatusMessage(`❌ Error: ${err.message}`);
    }
  };

  if (step === 'success' && username) {
    return (
      <div className="h-full w-full p-4 bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 h-full w-full">
          <h2 className="text-2xl font-semibold mb-4">Login Successful</h2>
          <p className="text-blue-600 text-lg">@{username}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-4 bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 h-full w-full space-y-6">
        <h2 className="text-2xl font-semibold text-center">Login with Telegram</h2>

        {step === 'phone' && (
          <div className="space-y-4">
            <input
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              type="text"
              placeholder="Phone number"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
            />
            <button
              onClick={handleSendCode}
              className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition"
            >
              Send Code
            </button>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-4">
            <input
              ref={codeInputRef}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              type="text"
              placeholder="Enter Telegram code"
              value={code}
              onChange={e => setCode(e.target.value)}
            />
            <input
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              type="password"
              placeholder="2FA password (if any)"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              onClick={handleConfirm}
              className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition"
            >
              Confirm Code
            </button>
          </div>
        )}

        {statusMessage && (
          <p className="text-center text-gray-700">{statusMessage}</p>
        )}
      </div>
    </div>
  );
};

export default TelegramLogin;
