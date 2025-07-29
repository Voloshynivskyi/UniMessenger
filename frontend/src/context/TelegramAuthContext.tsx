// src/context/TelegramAuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sendCode, authenticate, type AuthResponse } from '../api/telegramAuth';

console.log('🔷 TelegramAuthContext module loaded');

interface AuthContextType {
  session: string | null;
  status: 'idle' | 'sent' | '2fa' | 'authorized' | 'error';
  error: string | null;
  sendLoginCode: (phone: string) => Promise<void>;
  confirmCode: (code: string, password?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const TelegramAuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  console.log('🟢 TelegramAuthProvider mounted');

  const [sessionId] = useState(() => uuidv4());
  const [session, setSession] = useState<string | null>(() =>
    localStorage.getItem('tg_session')
  );
  const [status, setStatus] = useState<AuthContextType['status']>(
    session ? 'authorized' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('↻ TelegramAuthProvider useEffect session → localStorage', session);
    if (session) {
      localStorage.setItem('tg_session', session);
    }
  }, [session]);

  const sendLoginCode = async (phone: string) => {
    console.log('📤 sendLoginCode()', { phone, sessionId });
    setError(null);
    setStatus('idle');
    try {
      await sendCode(phone, sessionId);
      setStatus('sent');
      console.log('✅ sendLoginCode success');
    } catch (err: any) {
      console.error('❌ sendLoginCode error', err);
      setError(err.message);
      setStatus('error');
    }
  };

  const confirmCode = async (code: string, password?: string) => {
    console.log('📥 confirmCode()', { code, password });
    setError(null);
    try {
      const result: AuthResponse = await authenticate({
        phoneNumber: '', // можна додати зберігання номера
        sessionId,
        code,
        password,
      });
      console.log('📨 confirmCode result', result);
      if (result.status === 'AUTHORIZED') {
        setSession(result.session ?? null);
        setStatus('authorized');
      } else {
        setStatus('2fa');
      }
    } catch (err: any) {
      console.error('❌ confirmCode error', err);
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <AuthContext.Provider
      value={{ session, status, error, sendLoginCode, confirmCode }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useTelegramAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      'useTelegramAuth must be used within TelegramAuthProvider'
    );
  }
  return ctx;
}
