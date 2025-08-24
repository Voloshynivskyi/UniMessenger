// backend/utils/sessionResolver.ts
// Resolve a usable sessionId: prefer ?sessionId if it exists in DB and has a non-empty
// sessionString; otherwise fall back to cookie.sessionId. Throw a readable error if none.

import type { Request } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findValid(id?: string | null): Promise<string | null> {
  if (!id) return null;
  const row = await prisma.session.findUnique({ where: { sessionId: id } });
  if (!row) return null;
  if (!row.sessionString || row.sessionString.length === 0) return null;
  return row.sessionId;
}

export async function resolveSessionId(req: Request): Promise<string> {
  const q = (req.query?.sessionId as string | undefined)?.trim();
  const c = (req.cookies?.sessionId as string | undefined)?.trim();

  const qValid = await findValid(q);
  if (qValid) return qValid;

  const cValid = await findValid(c);
  if (cValid) return cValid;

  if (q && !qValid) throw new Error(`Session not found or not authorized (query): ${q}`);
  if (c && !cValid) throw new Error(`Session not found or not authorized (cookie): ${c}`);
  throw new Error('Session not found or not authorized');
}
