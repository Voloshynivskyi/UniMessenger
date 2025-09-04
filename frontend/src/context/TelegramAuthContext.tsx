// File: frontend/src/context/TelegramAuthContext.tsx
// Purpose: Multi-account manager with strict validation via checkSession().
// Now includes real server-side logout before removing an account from local storage.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { checkSession } from '../api/telegramAuth';

type TelegramAccount = { sessionId: string; username: string | null };

type Ctx = {
  accounts: TelegramAccount[];
  addAccount: (acc: TelegramAccount) => void;
  /** Remove locally + call backend /logout first (fire-and-forget). */
  removeAccount: (sessionId: string) => void;
  /** Explicit server-side logout + local removal (awaitable). */
  logoutAccount: (sessionId: string) => Promise<void>;
  /** Clear all accounts (attempts server logout for each, then wipes locally). */
  clearAll: () => void;
  authorized: boolean;
  sessionId: string | null;
  status: 'ready';
  username: string | null;
  error: string | null;
};

const KEY = 'tg_accounts_v2';
const AuthCtx = createContext<Ctx | undefined>(undefined);

// --- helpers ---------------------------------------------------------------

function loadAccounts(): TelegramAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((a: any) => ({
        sessionId: String(a?.sessionId || ''),
        username: a?.username ?? null,
      }))
      .filter((a: TelegramAccount) => !!a.sessionId);
  } catch {
    return [];
  }
}
function saveAccounts(list: TelegramAccount[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/** Call backend logout for a given sessionId via header-first policy. */
async function apiLogout(sessionId: string): Promise<boolean> {
  try {
    const resp = await fetch('/api/telegram/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId, // header-first policy
      },
    });
    console.log('[FE] apiLogout status=', resp.status);
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      console.warn('[FE] apiLogout error payload=', j);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[FE] apiLogout network error', e);
    return false;
  }
}

export const TelegramAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<TelegramAccount[]>(() => loadAccounts());
  const [error] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Validate stored accounts against backend (drop dead ones)
      if (accounts.length) {
        const checks = await Promise.all(accounts.map(a => checkSession(a.sessionId)));
        if (cancelled) return;
        const filtered = accounts.filter((a, i) => checks[i]);
        if (filtered.length !== accounts.length) {
          console.log('[FE] authCtx: filtered invalid accounts', {
            before: accounts.length,
            after: filtered.length,
          });
          setAccounts(filtered);
          saveAccounts(filtered);
        }
      }

      // Migrate legacy key if present
      const legacy = localStorage.getItem('tg_sessionId');
      if (legacy) {
        const ok = await checkSession(legacy);
        if (cancelled) return;
        if (ok && !accounts.find(a => a.sessionId === legacy)) {
          const next = [{ sessionId: legacy, username: null }, ...accounts];
          console.log('[FE] authCtx: migrated legacy sessionId -> accounts[0]');
          setAccounts(next);
          saveAccounts(next);
        } else {
          localStorage.removeItem('tg_sessionId');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const api: Ctx = useMemo(
    () => ({
      accounts,

      addAccount: (acc) => {
        setAccounts(prev => {
          const i = prev.findIndex(a => a.sessionId === acc.sessionId);
          const next = i === -1 ? [acc, ...prev] : [acc, ...prev.filter(a => a.sessionId !== acc.sessionId)];
          console.log('[FE] authCtx: addAccount', { sessionId: acc.sessionId, replaced: i !== -1 });
          saveAccounts(next);
          return next;
        });
      },

      // Fire-and-forget variant used by existing buttons: performs server logout first.
      removeAccount: (sessionId) => {
        void (async () => {
          console.log('[FE] removeAccount start sid=', sessionId);
          const ok = await apiLogout(sessionId);
          console.log('[FE] removeAccount apiLogout ok=', ok);
          setAccounts(prev => {
            const next = prev.filter(a => a.sessionId !== sessionId);
            saveAccounts(next);
            const legacy = localStorage.getItem('tg_sessionId');
            if (legacy && legacy === sessionId) localStorage.removeItem('tg_sessionId');
            return next;
          });
        })();
      },

      // Explicit, awaitable server-side logout + local removal.
      logoutAccount: async (sessionId) => {
        console.log('[FE] logoutAccount start sid=', sessionId);
        const ok = await apiLogout(sessionId);
        console.log('[FE] logoutAccount apiLogout ok=', ok);
        setAccounts(prev => {
          const next = prev.filter(a => a.sessionId !== sessionId);
          saveAccounts(next);
          const legacy = localStorage.getItem('tg_sessionId');
          if (legacy && legacy === sessionId) localStorage.removeItem('tg_sessionId');
          return next;
        });
      },

      clearAll: () => {
        void (async () => {
          console.log('[FE] clearAll start; count=', accounts.length);
          // Try to log out all in parallel; do not block UI on failures
          await Promise.allSettled(accounts.map(a => apiLogout(a.sessionId)));
          setAccounts([]);
          saveAccounts([]);
          localStorage.removeItem('tg_sessionId');
          console.log('[FE] clearAll done');
        })();
      },

      authorized: accounts.length > 0,
      sessionId: accounts.length ? accounts[0].sessionId : null,
      status: 'ready',
      username: accounts.length ? (accounts[0].username ?? null) : null,
      error,
    }),
    [accounts, error],
  );

  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>;
};

export function useTelegramAuth(): Ctx {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useTelegramAuth must be used within TelegramAuthProvider');
  return ctx;
}
