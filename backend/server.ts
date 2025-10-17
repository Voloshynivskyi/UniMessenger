import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

app.get("/", (_, res) => {
  res.send("🚀 UniMessenger API running");
});

// test route to verify DB connection
app.get("/api/test-db", async (_, res) => {
  const count = await prisma.user.count();
  res.json({ message: "Database connected", users: count });
});

const PORT = process.env.PORT || 7007;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
