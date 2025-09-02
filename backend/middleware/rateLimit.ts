// backend/middleware/rateLimit.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';

// Simple token bucket rate limiter keyed by (sessionId | ip) + method + path
type Bucket = { tokens: number; lastRefillMs: number };

export type RateLimitOptions = {
  windowMs?: number;          // refill window hint (for Retry-After calc)
  refillPerSec?: number;      // tokens added per second
  burst?: number;             // max bucket capacity
  excludePaths?: (string | RegExp)[]; // paths to skip limiting
};

const DEFAULTS: Required<RateLimitOptions> = {
  windowMs: 60_000,     // used only to compute Retry-After on 429
  refillPerSec: 2,      // 2 req/sec
  burst: 10,            // short spikes allowed
  excludePaths: [],     // nothing excluded by default
};

const buckets = new Map<string, Bucket>();

function pathIsExcluded(path: string, excludes: (string | RegExp)[]) {
  return excludes.some((p) =>
    typeof p === 'string' ? path.startsWith(p) : p.test(path)
  );
}

// Header-first extractor for sessionId with query aliases as fallback
function extractSessionId(req: Request): string | null {
  // 1) header → 2) query (s|sessionId|session) → 3) cookie
  const h = (req.header('x-session-id') || '').trim() || null;
  const q =
    (typeof req.query.s === 'string' && req.query.s.trim()) ||
    (typeof req.query.sessionId === 'string' && req.query.sessionId.trim()) ||
    (typeof req.query.session === 'string' && req.query.session.trim()) ||
    null;
  const c =
    typeof (req as any).cookies?.sessionId === 'string'
      ? (req as any).cookies.sessionId.trim()
      : null;

  return h || q || c;
}

export function rateLimit(opts: RateLimitOptions = {}): RequestHandler {
  const conf = { ...DEFAULTS, ...opts };

  return (req: Request, res: Response, next: NextFunction) => {
    if (pathIsExcluded(req.path, conf.excludePaths)) return next();

    const sessionId = extractSessionId(req);
    const principal = sessionId || req.ip; // fallback to IP if no sessionId

    // Key by principal + method + path for a fair split
    const key = `${principal}:${req.method}:${req.path}`;

    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: conf.burst, lastRefillMs: now };
      buckets.set(key, bucket);
    }

    // Refill based on elapsed time
    const elapsedSec = Math.max(0, (now - bucket.lastRefillMs) / 1000);
    if (elapsedSec > 0) {
      const refill = elapsedSec * conf.refillPerSec;
      bucket.tokens = Math.min(conf.burst, bucket.tokens + refill);
      bucket.lastRefillMs = now;
    }

    // Consume 1 token if available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return next();
    }

    // 429 Too Many Requests
    const retryAfterSec = Math.ceil((1 - bucket.tokens) / conf.refillPerSec);
    res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
    res.status(429).json({
      ok: false,
      error: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
    });
  };
}

export default rateLimit;
