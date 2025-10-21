/**
 * backend/utils/jwt.ts
 * JWT token generation utility for user authentication
 */

import jwt, { type JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("[jwt] JWT_SECRET is missing in .env");
}


const JWT_SECRET = process.env.JWT_SECRET;

export function generateToken(user_id: string): string {
  return jwt.sign({ user_id }, JWT_SECRET!, { expiresIn: "7d" });
}
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET);

  if (typeof decoded === "string") {
    throw new Error("[jwt] Invalid token payload");
  }

  return decoded;
}
