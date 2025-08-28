// File: frontend/src/lib/http.ts
// Purpose: Tiny HTTP client with cookie-less auth (x-session-id) + legacy-compatible API.
// Key points:
// - Exported named functions: apiUrl(path?) and WS_BASE(path?).
// - Auto-injects x-session-id from: opts.sessionId -> default -> ?session / ?sessionId / ?s
// - Default export: http with get/post/put/patch/delete.

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// ---- Session handling -------------------------------------------------------

let DEFAULT_SESSION_ID: string | null = null;

/** Set a default session id used for all requests unless overridden per-call. */
export function setDefaultSessionId(sessionId: string | null) {
  DEFAULT_SESSION_ID = sessionId?.trim() || null;
}

/** Read the current default session id. */
export function getDefaultSessionId(): string | null {
  return DEFAULT_SESSION_ID;
}

// ---- Base URL helpers -------------------------------------------------------

let __API_BASE_CACHE: string | undefined;

/** Internal: compute API base once (no trailing slash). */
function computeApiBase(): string {
  const vite = (import.meta as any)?.env?.VITE_API_BASE_URL;
  const injected = (globalThis as any)?.__API_BASE_URL;
  const base = (vite || injected || 'http://localhost:7007').toString();
  return base.replace(/\/+$/, '');
}

/** Join base URL and optional path with a single slash. */
function joinUrl(base: string, path?: string): string {
  if (!path) return base;
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

/** Public: return API base or base + path (legacy-compatible). */
export function apiUrl(path?: string): string {
  if (!__API_BASE_CACHE) __API_BASE_CACHE = computeApiBase();
  return joinUrl(__API_BASE_CACHE, path);
}

/** Public: return WS base (ws[s]://...) or base + path (legacy-compatible). */
export function WS_BASE(path?: string): string {
  const base = apiUrl().replace(/^http(s?):\/\//i, (_m, s) => `ws${s ? 's' : ''}://`);
  return joinUrl(base, path);
}

// ---- Internal URL & header helpers -----------------------------------------

/** Build absolute URL from base + path, preserving query params. */
function toURL(path: string): URL {
  if (/^https?:\/\//i.test(path)) return new URL(path);
  return new URL(path.replace(/^\/+/, ''), apiUrl() + '/');
}

/** Try to extract sessionId from the URL (?session=... / ?sessionId=... / ?s=...). */
function sessionFromUrl(u: URL): string | null {
  const s =
    u.searchParams.get('session') ||
    u.searchParams.get('sessionId') ||
    u.searchParams.get('s'); // ← support short alias
  return s ? s.trim() : null;
}

/** Ensure x-session-id header is present if we have a session id. */
function withSessionHeader(init: RequestInit = {}, sessionId: string | null): RequestInit {
  if (!sessionId) return init;
  const headers = new Headers(init.headers || {});
  if (!headers.has('x-session-id')) headers.set('x-session-id', sessionId);
  return { ...init, headers };
}

// ---- Core requester ---------------------------------------------------------

/** Core request helper returning parsed JSON (or throwing with rich error). */
async function request<T>(
  method: HttpMethod,
  path: string,
  body?: any,
  opts: { sessionId?: string | null; signal?: AbortSignal } = {}
): Promise<T> {
  const url = toURL(path);

  // Priority for session selection:
  // 1) opts.sessionId
  // 2) DEFAULT_SESSION_ID (setDefaultSessionId)
  // 3) ?session / ?sessionId / ?s (back-compat)
  const fromUrl = sessionFromUrl(url);
  const sessionId =
    (opts.sessionId != null ? opts.sessionId : DEFAULT_SESSION_ID) || fromUrl || null;

  let init: RequestInit = {
    method,
    headers: { Accept: 'application/json' },
    signal: opts.signal,
  };

  if (body !== undefined && body !== null) {
    init = {
      ...init,
      headers: { ...(init.headers as any), 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    };
  }

  init = withSessionHeader(init, sessionId);

  const resp = await fetch(url.toString(), init);

  const raw = await resp.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    if (!resp.ok) {
      const err = new Error(
        `HTTP ${resp.status} ${resp.statusText} at ${url.toString()} — non-JSON response`
      ) as any;
      err.status = resp.status;
      err.body = raw;
      throw err;
    }
    return null as unknown as T;
  }

  if (!resp.ok) {
    const err = new Error(
      data?.message || data?.error || `HTTP ${resp.status} ${resp.statusText} at ${url.toString()}`
    ) as any;
    err.status = resp.status;
    err.payload = data;
    throw err;
  }

  return data as T;
}

// ---- Public API -------------------------------------------------------------

export const http = {
  get<T>(path: string, opts?: { sessionId?: string | null; signal?: AbortSignal }) {
    return request<T>('GET', path, undefined, opts);
  },
  post<T>(path: string, body?: any, opts?: { sessionId?: string | null; signal?: AbortSignal }) {
    return request<T>('POST', path, body, opts);
  },
  put<T>(path: string, body?: any, opts?: { sessionId?: string | null; signal?: AbortSignal }) {
    return request<T>('PUT', path, body, opts);
  },
  patch<T>(path: string, body?: any, opts?: { sessionId?: string | null; signal?: AbortSignal }) {
    return request<T>('PATCH', path, body, opts);
  },
  delete<T>(path: string, opts?: { sessionId?: string | null; signal?: AbortSignal }) {
    return request<T>('DELETE', path, undefined, opts);
  },
};

export default http;
