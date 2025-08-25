// File: frontend/src/context/TelegramAuthContext.tsx
// Purpose: Multi-account manager with strict validation via checkSession().

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { checkSession } from '../api/telegramAuth';

type TelegramAccount = { sessionId: string; username: string | null };

type Ctx = {
  accounts: TelegramAccount[];
  addAccount: (acc: TelegramAccount) => void;
  removeAccount: (sessionId: string) => void;
  clearAll: () => void;
  authorized: boolean;
  sessionId: string | null;
  status: 'ready';
  username: string | null;
  error: string | null;
};

const KEY = 'tg_accounts_v2';
const AuthCtx = createContext<Ctx | undefined>(undefined);

function loadAccounts(): TelegramAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((a: any) => ({
      sessionId: String(a?.sessionId || ''),
      username: a?.username ?? null,
    })).filter((a: TelegramAccount) => !!a.sessionId);
  } catch {
    return [];
  }
}
function saveAccounts(list: TelegramAccount[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export const TelegramAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<TelegramAccount[]>(() => loadAccounts());
  const [error] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (accounts.length) {
        const checks = await Promise.all(accounts.map(a => checkSession(a.sessionId)));
        if (cancelled) return;
        const filtered = accounts.filter((a, i) => checks[i]);
        if (filtered.length !== accounts.length) {
          setAccounts(filtered);
          saveAccounts(filtered);
        }
      }

      const legacy = localStorage.getItem('tg_sessionId');
      if (legacy) {
        const ok = await checkSession(legacy);
        if (cancelled) return;
        if (ok && !accounts.find(a => a.sessionId === legacy)) {
          const next = [{ sessionId: legacy, username: null }, ...accounts];
          setAccounts(next);
          saveAccounts(next);
        } else {
          localStorage.removeItem('tg_sessionId');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const api: Ctx = useMemo(() => ({
    accounts,
    addAccount: (acc) => {
      setAccounts(prev => {
        const i = prev.findIndex(a => a.sessionId === acc.sessionId);
        const next = i === -1 ? [acc, ...prev] : [acc, ...prev.filter(a => a.sessionId !== acc.sessionId)];
        saveAccounts(next);
        return next;
      });
    },
    removeAccount: (sessionId) => {
      setAccounts(prev => {
        const next = prev.filter(a => a.sessionId !== sessionId);
        saveAccounts(next);
        const legacy = localStorage.getItem('tg_sessionId');
        if (legacy && legacy === sessionId) localStorage.removeItem('tg_sessionId');
        return next;
      });
    },
    clearAll: () => {
      setAccounts([]);
      saveAccounts([]);
      localStorage.removeItem('tg_sessionId');
    },
    authorized: accounts.length > 0,
    sessionId: accounts.length ? accounts[0].sessionId : null,
    status: 'ready',
    username: accounts.length ? (accounts[0].username ?? null) : null,
    error,
  }), [accounts, error]);

  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>;
};

export function useTelegramAuth(): Ctx {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useTelegramAuth must be used within TelegramAuthProvider');
  return ctx;
}
