// backend/utils/sessionResolver.ts
// Purpose: Resolve a usable sessionId from request with clear precedence.

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

type ResolveOpts = {
  /** If false, cookie will not be considered as a fallback. Defaults to true. */
  allowCookieFallback?: boolean;
};

export async function resolveSessionId(req: Request, opts?: ResolveOpts): Promise<string> {
  const allowCookie = opts?.allowCookieFallback !== false;

  // Read candidates from all common places
  const q = (req.query?.sessionId as string | undefined)?.trim();
  const h = (req.headers?.['x-session-id'] as string | undefined)?.trim();
  const b = (req.body?.sessionId as string | undefined)?.trim();
  const c = (req.cookies?.sessionId as string | undefined)?.trim();

  // Precedence: query -> header -> body -> cookie (cookie optional)
  const candidates = [q, h, b, allowCookie ? c : undefined];

  for (const cand of candidates) {
    const valid = await findValid(cand);
    if (valid) return valid;
  }

  // Build informative error
  const tried: string[] = [];
  if (q) tried.push(`query:${q}`);
  if (h) tried.push(`header:${h}`);
  if (b) tried.push(`body:${b}`);
  if (allowCookie && c) tried.push(`cookie:${c}`);

  if (tried.length) {
    throw new Error(`Session not found or not authorized (checked ${tried.join(', ')})`);
  }
  throw new Error('Session not found or not authorized');
}
