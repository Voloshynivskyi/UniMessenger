// backend/middleware/rateLimit.ts
import type { Request, Response, NextFunction } from 'express';

type Options = {
  /** Sliding window duration (ms). Example: 5000 means "per 5 seconds". */
  windowMs: number;
  /** Bucket capacity (max tokens in window). Also equals initial burst allowance. */
  max: number;
  /** Optional paths to exclude from limiting entirely (e.g., '/api/telegram/chats'). */
  excludePaths?: string[];
  /**
   * Optional extractor for session id. By default:
   *   query.sessionId -> header 'x-session-id' -> cookie 'sessionId'
   */
  getSessionId?: (req: Request) => string | null;
  /** Enable debug logging via env (e.g., RATE_LIMIT_DEBUG=1). */
  debugEnvVar?: string;
};

/**
 * Token-bucket limiter per (sessionId + HTTP method + path).
 * - Allows small bursts (e.g., double mount in React StrictMode).
 * - Smoothly refills over time.
 * - Falls back to IP if no sessionId is present.
 */
export function rateLimitBySession(opts: Options) {
  const {
    windowMs,
    max,
    excludePaths = [],
    getSessionId,
    debugEnvVar = 'RATE_LIMIT_DEBUG',
  } = opts;

  const DEBUG = !!process.env[debugEnvVar];

  // tokens_per_ms; example: max=10, window=5000ms => 0.002 token/ms
  const refillRate = max / windowMs;

  // key -> { tokens, last }
  const buckets = new Map<string, { tokens: number; last: number }>();

  function extractSessionId(req: Request): string | null {
    if (getSessionId) return getSessionId(req);
    const q = typeof req.query.sessionId === 'string' ? req.query.sessionId : null;
    const h = (req.headers['x-session-id'] as string) || null;
    const c = (req as any).cookies?.sessionId || null;
    return q || h || c;
  }

  function buildKey(req: Request): string {
    const method = req.method.toUpperCase();
    const fullPath = req.baseUrl + req.path; // e.g., '/api/telegram/chats'
    const sid = extractSessionId(req);
    if (sid) return `${sid}:${method}:${fullPath}`;
    return `anon:${req.ip}:${method}:${fullPath}`;
  }

  return function limiter(req: Request, res: Response, next: NextFunction) {
    const fullPath = req.baseUrl + req.path;
    if (excludePaths.includes(fullPath)) {
      if (DEBUG) console.log('[rateLimit] skip', fullPath);
      return next();
    }

    const key = buildKey(req);
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      // Start with full bucket → allow a small burst instantly
      bucket = { tokens: max, last: now };
      buckets.set(key, bucket);
    } else {
      // Refill based on elapsed time
      const elapsed = now - bucket.last;
      bucket.tokens = Math.min(max, bucket.tokens + elapsed * refillRate);
      bucket.last = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      if (DEBUG) console.log('[rateLimit] ok', key, 'tokens left:', bucket.tokens.toFixed(2));
      return next();
    }

    // Not enough tokens → 429
    const retryAfterSec = Math.ceil((1 - bucket.tokens) / refillRate / 1000);
    res.setHeader('Retry-After', String(Math.max(retryAfterSec, 1)));
    if (DEBUG) console.warn('[rateLimit] 429', key);
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  };
}
