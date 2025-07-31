// backend/routes/telegramSession.ts — check current Telegram session

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/me', async (req, res) => {
  const sessionId = req.cookies.sessionId;
  if (!sessionId) {
    return res.json({ authorized: false });
  }

  const dbSession = await prisma.session.findUnique({
    where: { sessionId },
    include: { user: true },
  });

  if (!dbSession || !dbSession.sessionString) {
    return res.json({ authorized: false });
  }

  return res.json({
    authorized: true,
    username: dbSession.user.username,
    firstName: dbSession.user.firstName,
    lastName: dbSession.user.lastName,
  });
});

export default router;