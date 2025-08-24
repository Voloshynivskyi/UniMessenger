// backend/services/dialogsCache.ts
type Key = string;

interface Entry<T> {
  expiresAt: number;
  value?: T;
  inflight?: Promise<T>;
}

const store = new Map<Key, Entry<any>>();
const DEFAULT_TTL_MS = 6000; // 6s

function makeKey(sessionId: string, limit: number) {
  return `${sessionId}::${limit}`;
}

export async function withDialogsCache<T>(
  sessionId: string,
  limit: number,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const key = makeKey(sessionId, limit);
  const now = Date.now();
  const entry = store.get(key);

  if (entry && entry.value && entry.expiresAt > now) return entry.value;
  if (entry?.inflight) return entry.inflight;

  const inflight = fetcher()
    .then((val) => {
      store.set(key, { value: val, expiresAt: Date.now() + ttlMs });
      return val;
    })
    .finally(() => {
      const e = store.get(key);
      if (e) e.inflight = undefined;
    });

  store.set(key, { inflight, expiresAt: 0 });
  return inflight;
}

// ✅ опційна інвалідація (коли треба примусово скинути кеш, наприклад після відправки повідомлення)
export function invalidateDialogsCache(sessionId?: string) {
  if (!sessionId) { store.clear(); return; }
  for (const key of store.keys()) {
    if (key.startsWith(`${sessionId}::`)) store.delete(key);
  }
}
