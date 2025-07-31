// src/context/TelegramAuthContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, MeResponse } from '../api/telegramAuth';
import { sendCode, authenticate, fetchMe, logout } from '../api/telegramAuth';
import { v4 as uuidv4 } from 'uuid';


interface AuthContextType {
  status: 'loading' | 'idle' | 'sent' | '2fa' | 'authorized' | 'error';
  username: string | null;
  error: string | null;
  sendLoginCode: (phone: string) => Promise<void>;
  confirmCode: (code: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const TelegramAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('tg_sessionId');
    if (!id) { id = uuidv4(); localStorage.setItem('tg_sessionId', id); }
    return id;
  });
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [status, setStatus] = useState<AuthContextType['status']>('loading');
  const [username, setUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMe().then((data: MeResponse) => {
      if (data.authorized) { setUsername(data.username ?? null); setStatus('authorized'); }
      else setStatus('idle');
    }).catch(err => { console.error(err); setError(err.message); setStatus('error'); });
  }, []);

  const sendLoginCode = async (phone: string) => {
    setError(null); setStatus('loading');
    try {
      await sendCode(phone, sessionId);
      setPhoneNumber(phone);
      setStatus('sent');
    } catch (err: any) {
      console.error(err); setError(err.message); setStatus('error');
    }
  };

  const confirmCode = async (code: string, password?: string) => {
    setError(null); setStatus('loading');
    try {
      const result: AuthResponse = await authenticate({ phoneNumber, sessionId, code, password });
      if (result.status === 'AUTHORIZED') { setUsername(result.username ?? null); setStatus('authorized'); }
      else setStatus('2fa');
    } catch (err: any) {
      console.error(err); setError(err.message); setStatus('error');
    }
  };

  const signOut = async () => {
    try {
      await logout();
      setUsername(null); setStatus('idle');
      localStorage.removeItem('tg_sessionId');
    } catch (err: any) {
      console.error(err); setError(err.message); setStatus('error');
    }
  };

  return (
    <AuthContext.Provider value={{ status, username, error, sendLoginCode, confirmCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useTelegramAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useTelegramAuth must be used within TelegramAuthProvider');
  return ctx;
}
