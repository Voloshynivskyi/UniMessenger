/**
 * backend/utils/jwt.ts
 * JWT helpers for issuing and verifying access tokens.
 * Provides strict typing for payloads and clear error messages.
 */

import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

/** Shape of the JWT payload we issue and expect. */
export interface DecodedToken extends JwtPayload {
  user_id: string;
}

/** Returns a non-empty JWT secret or throws an explicit configuration error. */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("[jwt] JWT_SECRET is missing in .env");
  return secret;
}

const DEFAULT_SIGN_OPTS: SignOptions = {
  algorithm: "HS256",
  expiresIn: "7d",
};

/**
 * Issues a signed JWT for the given user id.
 * @param user_id - Application user id to embed into the token.
 * @param options - Optional overrides for signing (expiry, etc.).
 * @returns Signed JWT string.
 */
export function generateToken(user_id: string, options?: SignOptions): string {
  const secret = getJwtSecret();
  return jwt.sign({ user_id }, secret, { ...DEFAULT_SIGN_OPTS, ...options });
}

/**
 * Verifies a JWT and returns a strictly typed payload.
 * Throws JWT-specific errors; middleware maps them to API error responses.
 * @param token - Raw bearer token (without the "Bearer " prefix).
 * @returns DecodedToken with a guaranteed `user_id` field.
 * @throws TokenExpiredError | JsonWebTokenError | Error (invalid shape)
 */
export function verifyToken(token: string): DecodedToken {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret);

  if (typeof decoded === "string") {
    // This should not happen when using object payloads.
    throw new Error("[jwt] Invalid token payload (string received).");
  }

  if (!decoded.user_id || typeof decoded.user_id !== "string") {
    throw new Error("[jwt] Token payload missing required 'user_id'.");
  }

  return decoded as DecodedToken;
}
