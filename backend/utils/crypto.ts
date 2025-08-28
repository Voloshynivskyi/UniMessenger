// File: backend/utils/crypto.ts
// Purpose: Utility functions for encrypting and decrypting session strings.
// Notes:
// - Robust .env loading with fallback: backend/.env -> project .env
// - Requires SESSION_KEY as 64-hex (32 bytes) for AES-256-GCM

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Try multiple .env locations in order; stop at the first that exists & parses
(function loadEnvFallback() {
  const candidates = [
    path.resolve(process.cwd(), 'backend', '.env'),            // dev ts-node
    path.resolve(process.cwd(), '.env'),                      // project root
    path.resolve(__dirname, '..', '..', '.env'),              // compiled dist
    path.resolve(__dirname, '..', '.env'),                    // fallback
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const res = dotenv.config({ path: p, override: false });
        if (res.parsed) break; // loaded successfully
      }
    } catch {
      // ignore and try next
    }
  }
})();

const ALGO = 'aes-256-gcm';

// Read key from env (hex -> Buffer). Must be exactly 32 bytes.
const KEY_HEX = (process.env.SESSION_KEY || '').trim();
const KEY = Buffer.from(KEY_HEX, 'hex');
if (KEY.length !== 32) {
  throw new Error(
    'SESSION_KEY must be a 64-char hex string (32 bytes). ' +
    'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

/** Encrypt UTF-8 text to base64 using AES-256-GCM (iv|tag|ciphertext). */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** Decrypt base64 (iv|tag|ciphertext) back to UTF-8 text. */
export function decrypt(encBase64: string): string {
  const data = Buffer.from(encBase64, 'base64');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
