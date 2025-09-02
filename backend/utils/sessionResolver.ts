// backend/utils/sessionResolver.ts
import type { Request } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type ResolveOptions = {
  /** If true, allow reading sessionId from cookie as a last resort */
  allowCookie?: boolean;
  /** If true (default), verify that the sessionId exists in DB and has a sessionString */
  requireInDb?: boolean;
};

/**
 * Resolve sessionId from request with a strict, unified priority:
 * 1) header: x-session-id
 * 2) query:  s | sessionId | session
 * 3) body:   sessionId
 * 4) cookie: sessionId      (only if allowCookie === true)
 *
 * If requireInDb === true, validates that sessionId exists in DB and has a non-empty sessionString.
 */
export async function resolveSessionId(
  req: Request,
  opts: ResolveOptions = {}
): Promise<string | null> {
  const { allowCookie = false, requireInDb = true } = opts;

  // --- Header-first; query aliases supported (s, sessionId, session)
  // (English comments in code per user's preference)
  const headerSid =
    (req.header('x-session-id')?.trim() || '') || null;

  const querySid =
    (typeof req.query.s === 'string' && req.query.s.trim()) ||
    (typeof req.query.sessionId === 'string' && req.query.sessionId.trim()) ||
    (typeof req.query.session === 'string' && req.query.session.trim()) ||
    null;

  const bodySid =
    (typeof (req as any).body?.sessionId === 'string' &&
      (req as any).body.sessionId.trim()) ||
    null;

  const cookieSid =
    allowCookie && typeof (req as any).cookies?.sessionId === 'string'
      ? (req as any).cookies.sessionId.trim()
      : null;

  const candidates = [headerSid, querySid, bodySid, cookieSid].filter(Boolean) as string[];

  for (const sessionId of candidates) {
    if (!requireInDb) return sessionId;

    // Validate existence in DB and non-empty encrypted sessionString
    const row = await prisma.session.findUnique({
      where: { sessionId },
      select: { sessionString: true },
    });

    if (row?.sessionString && row.sessionString.length > 0) {
      return sessionId;
    }
  }

  return null;
}

/**
 * Helper to require a valid sessionId or throw an HTTP-like error.
 */
export async function requireSessionId(
  req: Request,
  opts: ResolveOptions = {}
): Promise<string> {
  const sid = await resolveSessionId(req, opts);
  if (!sid) {
    const err = new Error('SESSION_NOT_FOUND');
    (err as any).status = 401;
    (err as any).code = 'SESSION_NOT_FOUND';
    throw err;
  }
  return sid;
}

export default resolveSessionId;
