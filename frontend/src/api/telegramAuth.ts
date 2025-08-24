// File: frontend/src/api/telegramAuth.ts
// API functions for Telegram authentication (login, logout, me).

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7007';

export interface SendCodeResponse { phoneCodeHash: string; }
export type AuthStatus = 'AUTHORIZED' | '2FA_REQUIRED';
export interface AuthResponse { status: AuthStatus; session?: string; username?: string; }
export interface MeResponse { authorized: boolean; username?: string; firstName?: string; lastName?: string; }

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || 'API error');
  return data as T;
}

export async function sendCode(phoneNumber: string, sessionId: string): Promise<SendCodeResponse> {
  const res = await fetch(`${BASE_URL}/auth/telegram/start`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, sessionId }),
  });
  return handleResponse<SendCodeResponse>(res);
}

// Тепер передаємо один обʼєкт з усіма полями
export async function authenticate(params: {
  phoneNumber: string; sessionId: string; code: string; password?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/telegram/auth`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (res.status === 401) {
    const d = await res.json(); return { status: (d as AuthResponse).status };
  }
  return handleResponse<AuthResponse>(res);
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch(`${BASE_URL}/auth/telegram/me`, { method: 'GET', credentials: 'include' });
  return handleResponse<MeResponse>(res);
}

export async function logout(): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/telegram/logout`, { method: 'POST', credentials: 'include' });
  if (!res.ok) { const d = await res.json(); throw new Error((d as any).error || 'Logout failed'); }
}
