// File: frontend/src/api/telegramMedia.ts
// Purpose: Frontend helpers to send media via backend endpoints.
// - sendMediaUrl: JSON -> { peerKey, url, caption?, forceDocument?, replyToId? }
// - sendMediaFile: multipart/form-data -> file + fields
//
// Both return { ok: true, message: Msg } shape.

export type Msg = {
  id: number | string;
  peerKey: string;
  text?: string | null;
  date?: number | string | null;
  out?: boolean;
  service?: boolean;
};

export type SendMediaResponse = { ok: true; message: Msg };

type UrlOpts = {
  caption?: string;
  forceDocument?: boolean;
  replyToId?: number;
};

type FileOpts = {
  caption?: string;
  forceDocument?: boolean;
  replyToId?: number;
};

/** Send a media file by URL (no multipart). */
export async function sendMediaUrl(
  sessionId: string,
  peerKey: string,
  url: string,
  opts: UrlOpts = {}
): Promise<SendMediaResponse> {
  // English: validate inputs defensively on client side
  if (!sessionId) throw new Error('Missing sessionId');
  if (!peerKey) throw new Error('peerKey required');
  if (!url) throw new Error('url required');

  const res = await fetch('/api/telegram/sendMedia', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      peerKey,
      url,
      ...(opts.caption ? { caption: opts.caption } : {}),
      ...(opts.forceDocument ? { forceDocument: true } : {}),
      ...(opts.replyToId != null ? { replyToId: opts.replyToId } : {}),
    }),
    credentials: 'include', // keep parity with other calls
  });

  if (!res.ok) {
    const errText = await safeReadText(res);
    throw new Error(errText || `sendMediaUrl failed: ${res.status}`);
  }

  const data = (await res.json()) as SendMediaResponse | any;
  // English: accept either {ok, message} or raw message for robustness
  if (data && data.ok && data.message) return data as SendMediaResponse;
  return { ok: true, message: data } as SendMediaResponse;
}

/** Send a local file using multipart/form-data. */
export async function sendMediaFile(
  sessionId: string,
  peerKey: string,
  file: File | Blob,
  opts: FileOpts = {}
): Promise<SendMediaResponse> {
  if (!sessionId) throw new Error('Missing sessionId');
  if (!peerKey) throw new Error('peerKey required');
  if (!file) throw new Error('file required');

  const fd = new FormData();
  fd.append('file', file);
  fd.append('peerKey', peerKey);
  if (opts.caption) fd.append('caption', opts.caption);
  if (opts.forceDocument) fd.append('forceDocument', 'true');
  if (opts.replyToId != null) fd.append('replyToId', String(opts.replyToId));

  const res = await fetch('/api/telegram/sendMedia/file', {
    method: 'POST',
    headers: {
      'x-session-id': sessionId,
      // English: do NOT set Content-Type manually; browser will set boundary.
    },
    body: fd,
    credentials: 'include',
  });

  if (!res.ok) {
    const errText = await safeReadText(res);
    throw new Error(errText || `sendMediaFile failed: ${res.status}`);
  }

  const data = (await res.json()) as SendMediaResponse | any;
  if (data && data.ok && data.message) return data as SendMediaResponse;
  return { ok: true, message: data } as SendMediaResponse;
}

// ----------------- small helpers -----------------

async function safeReadText(res: Response): Promise<string> {
  try {
    const t = await res.text();
    // English: try to unwrap JSON-ish error payloads
    try {
      const j = JSON.parse(t);
      return String(j?.message || j?.error || t || '');
    } catch {
      return t;
    }
  } catch {
    return '';
  }
}
