// File: backend/utils/crypto.ts
// Utility functions for encrypting and decrypting session strings.

import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';

// Load env from backend/.env
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

const ALGO = 'aes-256-gcm';
const KEY = Buffer.from(process.env.SESSION_KEY || '', 'hex');
if (KEY.length !== 32) {
  throw new Error('SESSION_KEY must be a 64-char hex string (32 bytes)');
}
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

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
