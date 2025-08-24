// File: frontend/src/context/TelegramAuthContext.tsx
// React context for Telegram authentication state and actions.

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, MeResponse } from '../api/telegramAuth';
import { sendCode, authenticate, fetchMe, logout } from '../api/telegramAuth';
import { v4 as uuidv4 } from 'uuid';

interface AuthContextType {
  status: 'loading' | 'idle' | 'sent' | '2fa' | 'authorized' | 'error';
  username: string | null;
  error: string | null;
  sessionId: string;
  authorized: boolean;
  sendLoginCode: (phone: string) => Promise<void>;
  confirmCode: (code: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const TelegramAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Keep setter to resync sessionId after /auth
  const [sessionId, setSessionId] = useState<string>(() => {
    let id = localStorage.getItem('tg_sessionId');
    if (!id) { id = uuidv4(); localStorage.setItem('tg_sessionId', id); }
    return id;
  });

  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [status, setStatus] = useState<AuthContextType['status']>('loading');
  const [username, setUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check current authentication (cookie-based)
  useEffect(() => {
    fetchMe()
      .then((data: MeResponse) => {
        if (data.authorized) {
          setUsername(data.username ?? null);
          setStatus('authorized');
        } else {
          setStatus('idle');
        }
      })
      .catch(err => {
        setError(err.message);
        setStatus('error');
      });
  }, []);

  const sendLoginCode = async (phone: string) => {
    setError(null);
    setStatus('loading');
    try {
      await sendCode(phone, sessionId);
      setPhoneNumber(phone);
      setStatus('sent');
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  const confirmCode = async (code: string, password?: string) => {
    setError(null);
    setStatus('loading');
    try {
      const result: AuthResponse = await authenticate({ phoneNumber, sessionId, code, password });
      if (result.status === 'AUTHORIZED') {
        const newId = result.session || sessionId;
        // Resync local and state so all next requests & WS use the right session
        localStorage.setItem('tg_sessionId', newId);
        setSessionId(newId);

        setUsername(result.username ?? null);
        setStatus('authorized');
      } else {
        setStatus('2fa');
      }
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  const signOut = async () => {
    try {
      await logout();
      setUsername(null);
      setStatus('idle');
      // Optionally keep tg_sessionId to reuse for next login flow
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        username,
        error,
        sessionId,
        authorized: status === 'authorized',
        sendLoginCode,
        confirmCode,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useTelegramAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useTelegramAuth must be used within TelegramAuthProvider');
  return ctx;
}

