import { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateToken } from "../utils/jwt";

const prisma = new PrismaClient();
export async function registerUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: { email, passwordHash: hashedPassword },
    });
    const token = generateToken(newUser.id);
    return res
      .status(201)
      .json({ token, user: { id: newUser.id, email: newUser.email } });
  } catch (err) {
    console.log("Register error: ", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }
    const isValid = await comparePassword(password, existingUser.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Password is not valid" });
    }
    const token = generateToken(existingUser.id);
    return res.status(201).json({
      token,
      user: { id: existingUser.id, email: existingUser.email },
    });
  } catch (err) {
    console.log("Login error: ", err);
    return res.status(500).json({ message: "Server error" });
  }
}
