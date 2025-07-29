// testTelegramAuth.ts

import path from 'path';
import dotenv from 'dotenv';
import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'node:process';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '.env') });

interface StartResponse {
  phoneCodeHash: string;
}

interface AuthResult {
  status: 'AUTHORIZED' | '2FA_REQUIRED';
  session?: string;
}

/**
 * Utility for POST requests
 */
async function post<T>(urlPath: string, body: unknown): Promise<T> {
  const res = await fetch(`http://localhost:7007${urlPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text);
  }
  return JSON.parse(text) as T;
}

async function main(): Promise<void> {
  const phoneNumber = process.env.TEST_PHONE ?? '+380508329608';
  const sessionId = process.env.TEST_SESSION ?? 'user-1';

  // Step 1: request code
  console.log('→ POST /auth/telegram/start');
  let phoneCodeHash: string;
  try {
    ({ phoneCodeHash } = await post<StartResponse>('/auth/telegram/start', {
      phoneNumber,
      sessionId,
    }));
  } catch (err: any) {
    console.error('❌ Failed to request code:', err.message);
    process.exit(1);
  }
  console.log('✅ phoneCodeHash:', phoneCodeHash);

  // Prepare readline interface
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    // Ask for code
    const code = (await rl.question('Enter the code you received: ')).trim();

    // Ask for 2FA password if needed (leave blank if no 2FA)
    const password = (await rl.question('Enter 2FA password (leave blank if none): ')).trim() || undefined;

    // Step 2: authenticate (with or without password)
    console.log('→ POST /auth/telegram/auth');
    const result = await post<AuthResult>('/auth/telegram/auth', {
      phoneNumber,
      code,
      sessionId,
      ...(password ? { password } : {}),
    });

    if (result.status === 'AUTHORIZED') {
      console.log('✅ Authorized! Session:', result.session);
    } else if (result.status === '2FA_REQUIRED') {
      console.log('⚠️ 2FA required but no password provided or incorrect.');
    } else {
      console.log('ℹ️ Response:', result);
    }
  } catch (err: any) {
    console.error('❌ Authentication error:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
