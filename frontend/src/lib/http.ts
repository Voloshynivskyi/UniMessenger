// File: frontend/src/lib/http.ts
// HTTP and WebSocket base URL helpers for API requests.

export const HTTP_BASE =
  import.meta.env.VITE_BACKEND_HTTP_BASE?.replace(/\/+$/, '') || '';

export function WS_BASE(): string {
  const env = import.meta.env.VITE_BACKEND_WS_BASE?.replace(/\/+$/, '');
  if (env) return env;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

export function apiUrl(path: string): string {
  return `${HTTP_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
