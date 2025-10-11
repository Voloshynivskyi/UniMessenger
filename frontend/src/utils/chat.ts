// File: frontend/src/utils/chat.ts
// Small helpers used in several components (no React imports)

// Seconds/ISO to epoch ms
export function toEpoch(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

// Placeholder for file bubbles
export function labelForFile(file: File | Blob): string {
  const name = (file as any).name ? String((file as any).name) : '';
  const mt = (file as any).type ? String((file as any).type) : '';
  if (mt.startsWith('image/')) return '[photo]';
  if (mt.startsWith('video/')) return '[video]';
  if (mt.startsWith('audio/')) return '[audio]';
  if (mt === 'application/pdf') return '[document]';
  if (name) return `[${name}]`;
  return '[document]';
}
