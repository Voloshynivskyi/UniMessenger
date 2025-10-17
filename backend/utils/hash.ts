import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcrypt";

// English: Hash plain password with bcrypt (10-12 salt rounds).
export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(parseInt(process.env.SALT_ROUNDS || "10"));
  return await bcrypt.hash(plain, salt);
}

// English: Compare a plain password with a bcrypt hash.
export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(plain, hash);
}
