// frontend/src/lib/http.ts
// Tiny fetch wrapper that always prefers the explicit x-session-id header.
// (English comments in code per user's preference)

let defaultSessionId: string | null = null;
let baseUrl: string | null = null;

/** Optionally set a base URL for all requests (e.g., from Vite env) */
export function setBaseUrl(url: string | null) {
  baseUrl = url && url.trim().length ? url : null;
}

/** Set or clear the default session id used for requests */
export function setDefaultSessionId(sid: string | null) {
  defaultSessionId = sid && sid.trim().length ? sid : null;
}

/** Read current default session id (for backward compatibility) */
export function getDefaultSessionId(): string | null {
  return defaultSessionId;
}

/** Internal: merge headers with optional x-session-id (header-first policy) */
function buildHeaders(
  input?: HeadersInit,
  sessionId?: string | null
): Headers {
  const h = new Headers(input || {});
  const sid = sessionId ?? defaultSessionId;
  if (sid) {
    // Explicit header always wins (do not append to query)
    h.set('x-session-id', sid);
  }
  if (!h.has('Content-Type')) {
    h.set('Content-Type', 'application/json');
  }
  return h;
}

type HttpOpts = {
  headers?: HeadersInit;
  sessionId?: string | null;
  signal?: AbortSignal;
  credentials?: RequestCredentials; // default 'same-origin'
};

function withBase(url: string) {
  if (!baseUrl) return url;
  // don't double-prefix absolute URLs
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

/** Public helper for building absolute API URLs (backward-compatible) */
export function apiUrl(path: string): string {
  return withBase(path);
}

/** Public helper for resolving WS base (wss:// for https, ws:// otherwise) */
export function WS_BASE(): string {
  if (baseUrl) {
    try {
      const u = new URL(baseUrl);
      const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${u.host}`;
    } catch {
      // if baseUrl is not a valid absolute URL, fall back to window.location
    }
  }
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost';
  return `${isHttps ? 'wss:' : 'ws:'}//${host}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const err = new Error(
      (isJson && (payload as any)?.message) ||
        `HTTP ${res.status} ${res.statusText}`
    );
    (err as any).status = res.status;
    (err as any).code = isJson ? (payload as any)?.error : undefined;
    throw err;
  }

  return payload as T;
}

export async function httpGet<T = any>(url: string, opts: HttpOpts = {}): Promise<T> {
  const res = await fetch(withBase(url), {
    method: 'GET',
    headers: buildHeaders(opts.headers, opts.sessionId ?? null),
    signal: opts.signal,
    credentials: opts.credentials ?? 'same-origin',
  });
  return handleResponse<T>(res);
}

export async function httpPost<T = any>(
  url: string,
  body?: any,
  opts: HttpOpts = {}
): Promise<T> {
  const res = await fetch(withBase(url), {
    method: 'POST',
    headers: buildHeaders(opts.headers, opts.sessionId ?? null),
    body: body === undefined ? null : JSON.stringify(body),
    signal: opts.signal,
    credentials: opts.credentials ?? 'same-origin',
  });
  return handleResponse<T>(res);
}

// Default export for convenience (both styles can be used)
const http = {
  get: httpGet,
  post: httpPost,
  setBaseUrl,
  setDefaultSessionId,
  getDefaultSessionId,
  apiUrl,
  WS_BASE,
};

export default http;
