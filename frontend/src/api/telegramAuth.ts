// src/api/telegramAuth.ts
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7007';

export interface SendCodeResponse {
  phoneCodeHash: string;
}

export type AuthStatus = 'AUTHORIZED' | '2FA_REQUIRED';

export interface AuthResponse {
  status: AuthStatus;
  session?: string;
  username?: string;    // додали username
}

export async function sendCode(
  phoneNumber: string,
  sessionId: string
): Promise<SendCodeResponse> {
  const res = await fetch(`${BASE_URL}/auth/telegram/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, sessionId }),
  });

  const data = (await res.json()) as SendCodeResponse | { error: string };

  if (!res.ok) {
    const errMsg = (data as { error: string }).error || 'Failed to send code';
    throw new Error(errMsg);
  }

  return data as SendCodeResponse;
}

export async function authenticate(params: {
  phoneNumber: string;
  code: string;
  sessionId: string;
  password?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/telegram/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await res.json()) as AuthResponse | { error: string };

  if (res.status === 401) {
    // повернемо { status: '2FA_REQUIRED' }
    return { status: (data as AuthResponse).status };
  }
  if (!res.ok) {
    const errMsg = (data as { error: string }).error || 'Authentication failed';
    throw new Error(errMsg);
  }

  return data as AuthResponse;
}
