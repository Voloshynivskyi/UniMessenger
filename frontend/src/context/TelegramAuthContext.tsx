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
    console.log('[TelegramAuthContext] Checking Telegram session...');
    fetchMe().then((data: MeResponse) => {
      if (data.authorized) { 
        setUsername(data.username ?? null); 
        setStatus('authorized'); 
        console.log('[TelegramAuthContext] User authorized:', data.username);
      }
      else {
        setStatus('idle');
        console.warn('[TelegramAuthContext] User not authorized');
      }
    }).catch(err => { 
      console.error('[TelegramAuthContext] Error fetching session:', err); 
      setError(err.message); 
      setStatus('error'); 
    });
  }, []);

  const sendLoginCode = async (phone: string) => {
    setError(null); setStatus('loading');
    try {
      console.log('[TelegramAuthContext] Sending login code for phone:', phone);
      await sendCode(phone, sessionId);
      setPhoneNumber(phone);
      setStatus('sent');
      console.log('[TelegramAuthContext] Login code sent');
    } catch (err: any) {
      console.error('[TelegramAuthContext] Error sending login code:', err);
      setError(err.message); setStatus('error');
    }
  };

  const confirmCode = async (code: string, password?: string) => {
    setError(null); setStatus('loading');
    try {
      console.log('[TelegramAuthContext] Confirming code:', code);
      const result: AuthResponse = await authenticate({ phoneNumber, sessionId, code, password });
      if (result.status === 'AUTHORIZED') { 
        setUsername(result.username ?? null); 
        setStatus('authorized'); 
        console.log('[TelegramAuthContext] User authorized:', result.username);
      }
      else {
        setStatus('2fa');
        console.warn('[TelegramAuthContext] 2FA required');
      }
    } catch (err: any) {
      console.error('[TelegramAuthContext] Error confirming code:', err);
      setError(err.message); setStatus('error');
    }
  };

  const signOut = async () => {
    try {
      console.log('[TelegramAuthContext] Logging out');
      await logout();
      setUsername(null); setStatus('idle');
      localStorage.removeItem('tg_sessionId');
      console.log('[TelegramAuthContext] Logged out');
    } catch (err: any) {
      console.error('[TelegramAuthContext] Error logging out:', err);
      setError(err.message); setStatus('error');
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
