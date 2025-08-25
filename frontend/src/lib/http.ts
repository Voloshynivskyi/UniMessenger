// File: frontend/src/lib/http.ts
// Centralized helpers to build absolute HTTP/WS URLs to the backend.
// In dev: defaults to http(s)://<host>:7007 and ws(s)://<host>:7007.
// You can override with VITE_BACKEND_HTTP_BASE / VITE_BACKEND_WS_BASE.

export function API_BASE(): string {
  // Allow override via env at build time
  // e.g. VITE_BACKEND_HTTP_BASE="http://localhost:7007"
  const envBase = (import.meta as any).env?.VITE_BACKEND_HTTP_BASE as string | undefined;
  if (envBase) return envBase.replace(/\/+$/, '');

  const { protocol, hostname } = window.location;
  const isHttps = protocol === 'https:';
  const port = '7007';
  return `${isHttps ? 'https' : 'http'}://${hostname}:${port}`;
}

export function WS_BASE(): string {
  // Allow override via env at build time
  // e.g. VITE_BACKEND_WS_BASE="ws://localhost:7007"
  const envBase = (import.meta as any).env?.VITE_BACKEND_WS_BASE as string | undefined;
  if (envBase) return envBase.replace(/\/+$/, '');

  const { protocol, hostname } = window.location;
  const isHttps = protocol === 'https:';
  const port = '7007';
  return `${isHttps ? 'wss' : 'ws'}://${hostname}:${port}`;
}

/** Build full API url from a path like "/api/telegram/start" */
export function apiUrl(path: string): string {
  const base = API_BASE();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
