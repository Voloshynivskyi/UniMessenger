/**
 * backend/utils/hash.ts
 * Password hashing utilities using bcrypt with safe defaults.
 */

import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcrypt";

/** Coerces SALT_ROUNDS to a safe integer within [8..14], defaults to 10. */
function getSaltRounds(): number {
  const raw = Number(process.env.SALT_ROUNDS ?? 10);
  if (!Number.isFinite(raw)) return 10;
  return Math.min(14, Math.max(8, Math.trunc(raw)));
}

/**
 * Hashes a plain text password using bcrypt with configured salt rounds.
 * @param plain - Plain text password.
 * @returns Bcrypt hash suitable for storage.
 */
export async function hashPassword(plain: string): Promise<string> {
  const rounds = getSaltRounds();
  const salt = await bcrypt.genSalt(rounds);
  return bcrypt.hash(plain, salt);
}

/**
 * Compares a plain text password against a bcrypt hash.
 * @param plain - Candidate password.
 * @param hash - Stored bcrypt hash.
 * @returns True if the password matches, false otherwise.
 */
export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
