// File: frontend/src/api/telegramAuth.ts
// Purpose: Auth API client for Telegram login, session check, and logout.

import { apiUrl } from '../lib/http';

export interface AuthResponse {
  status: 'AUTHORIZED' | '2FA_REQUIRED';
  session?: string;
  username?: string | null;
}

export interface MeResponse {
  authorized: boolean;
  username?: string | null;
}

export async function sendCode(phoneNumber: string, sessionId: string): Promise<void> {
  const res = await fetch(apiUrl('/api/telegram/start'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({ phoneNumber, sessionId }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
}

export async function authenticate(payload: {
  phoneNumber: string;
  sessionId: string;
  code: string;
  password?: string;
}): Promise<AuthResponse> {
  const res = await fetch(apiUrl('/api/telegram/confirm'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-id': payload.sessionId },
    body: JSON.stringify(payload),
  });
  const ct = res.headers.get('content-type') || '';
  const txt = await res.text();
  if (!res.ok) {
    try { const j = JSON.parse(txt); throw new Error(j?.error || txt); }
    catch { throw new Error(txt || `HTTP ${res.status}`); }
  }
  if (!ct.includes('application/json')) throw new Error(`Non-JSON response:\n${txt.slice(0,200)}`);
  return JSON.parse(txt);
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch(apiUrl('/api/telegram/me'), { credentials: 'include' });
  const ct = res.headers.get('content-type') || '';
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  if (!ct.includes('application/json')) throw new Error(`Non-JSON response:\n${txt.slice(0,200)}`);
  return JSON.parse(txt);
}

export async function logout(): Promise<void> {
  const res = await fetch(apiUrl('/api/telegram/logout'), {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
}

/** Lightweight validation against backend DB only (no Telegram calls). */
export async function checkSession(sessionId: string): Promise<boolean> {
  const url = apiUrl(`/api/telegram/health?sessionId=${encodeURIComponent(sessionId)}`);
  const res = await fetch(url, { headers: { 'x-session-id': sessionId } });
  if (res.ok) return true;
  // 404 means not found; anything else — treat as invalid to be safe
  return false;
}
