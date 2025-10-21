// backend/utils/telegramSession.ts
import crypto from "crypto";
const ALGO = "aes-256-cbc";
const KEY_HEX = process.env.SESSION_KEY!;
const IV_HEX = process.env.SESSION_IV!;

const KEY = Buffer.from(KEY_HEX, "hex");
const IV = Buffer.from(IV_HEX, "hex");

export function encryptSession(plain: string): string {
  const cipher = crypto.createCipheriv(ALGO, KEY, IV);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return encrypted.toString("hex");
}

export function decryptSession(cipherHex: string): string {
  const decipher = crypto.createDecipheriv(ALGO, KEY, IV);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
