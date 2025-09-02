// File: frontend/src/api/telegramAuth.ts
// Purpose: Auth API client for Telegram login, session check, and logout.
// Notes:
// - Uses shared http wrapper so x-session-id header is always set (header-first).
// - We do NOT send sessionId in body/query anymore (header is the single source of truth).

import http from '../lib/http';

export interface AuthResponse {
  status: 'AUTHORIZED' | '2FA_REQUIRED';
  session?: string;
  username?: string | null;
}

export interface MeResponse {
  authorized: boolean;
  username?: string | null;
}

/** Start login by sending a code to the phone number. */
export async function sendCode(phoneNumber: string, sessionId: string): Promise<void> {
  // English comment: header-first; body contains only what backend needs semantically
  await http.post('/api/telegram/start', { phoneNumber }, { sessionId });
}

/** Confirm code (and optional 2FA password). Returns auth status & username. */
export async function authenticate(payload: {
  phoneNumber: string;
  sessionId: string;
  code: string;
  password?: string;
}): Promise<AuthResponse> {
  const { phoneNumber, sessionId, code, password } = payload;
  return http.post<AuthResponse>(
    '/api/telegram/confirm',
    { phoneNumber, code, ...(password ? { password } : {}) },
    { sessionId }
  );
}

/** Optional: legacy "me" endpoint via header-first (preferred). */
export async function fetchMeWithSession(sessionId: string): Promise<MeResponse> {
  return http.get<MeResponse>('/api/telegram/me', { sessionId });
}

/** Legacy cookie-based "me" (kept for compatibility if some route still expects cookies). */
export async function fetchMe(): Promise<MeResponse> {
  // English comment: try cookie-based if server keeps supporting it; consider removing later
  const res = await fetch('/api/telegram/me', { credentials: 'include' });
  const ct = res.headers.get('content-type') || '';
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  if (!ct.includes('application/json')) throw new Error(`Non-JSON response:\n${txt.slice(0,200)}`);
  return JSON.parse(txt);
}

/** Logout (front-only). Cookies are cleared server-side if they were used before. */
export async function logout(sessionId?: string): Promise<void> {
  // English comment: header not required, but harmless; avoids any cookie reliance
  await http.post('/api/telegram/logout', null, { sessionId: sessionId ?? null });
}

/** Lightweight validation against backend DB only (no Telegram calls). */
export async function checkSession(sessionId: string): Promise<boolean> {
  // English comment: header-first; do not pass sessionId in query anymore
  try {
    await http.get('/api/telegram/health', { sessionId });
    return true;
  } catch {
    return false;
  }
}
