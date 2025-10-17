import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

export function generateToken(user_id: string): string {
  return jwt.sign({ user_id }, JWT_SECRET!, { expiresIn: "7d" });
}
