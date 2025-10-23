/**
 * backend/utils/telegramSession.ts
 * Symmetric encryption helpers for Telegram session strings.
 * AES-256-CBC with static key+IV from environment variables.
 * NOTE: Key management is critical. Rotate keys with a migration plan.
 */

import crypto from "crypto";

const ALGO = "aes-256-cbc";

/**
 * Validates and returns a Buffer from a hex string.
 * @param hex - Hex-encoded key/iv material.
 * @param expectedBytes - Exact number of bytes required.
 * @param name - Human-readable label for error messages.
 */
function hexToBufferStrict(
  hex: string | undefined,
  expectedBytes: number,
  name: string
): Buffer {
  if (!hex) {
    throw new Error(`[telegramSession] Missing ${name} in environment`);
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`[telegramSession] ${name} must be hex-encoded`);
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== expectedBytes) {
    throw new Error(
      `[telegramSession] ${name} must be ${expectedBytes} bytes (got ${buf.length})`
    );
  }
  return buf;
}

// Expect 32-byte key (256-bit) and 16-byte IV for AES-256-CBC.
const KEY = hexToBufferStrict(process.env.SESSION_KEY, 32, "SESSION_KEY");
const IV = hexToBufferStrict(process.env.SESSION_IV, 16, "SESSION_IV");

/**
 * Encrypts a UTF-8 session string to a hex-encoded ciphertext.
 * @param plain - Decrypted session string (as produced by Telegram client).
 * @returns Hex-encoded ciphertext.
 */
export function encryptSession(plain: string): string {
  const cipher = crypto.createCipheriv(ALGO, KEY, IV);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return encrypted.toString("hex");
}

/**
 * Decrypts a hex-encoded ciphertext back to a UTF-8 session string.
 * @param cipherHex - Hex-encoded ciphertext to decrypt.
 * @returns Decrypted session string (plain).
 */
export function decryptSession(cipherHex: string): string {
  const decipher = crypto.createDecipheriv(ALGO, KEY, IV);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
