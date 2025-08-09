import { Request, Response, NextFunction } from 'express';

/**
 * Very light, in-memory rate limiter by sessionId.
 * Not for production. Will be replaced by Redis later.
 */
const lastCallBySession = new Map<string, number>();

export function rateLimitBySession(minIntervalMs = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const sessionId = String(req.query.sessionId || req.body?.sessionId || '');
    if (!sessionId) return next();

    const now = Date.now();
    const prev = lastCallBySession.get(sessionId) ?? 0;

    if (now - prev < minIntervalMs) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }

    lastCallBySession.set(sessionId, now);
    next();
  };
}
