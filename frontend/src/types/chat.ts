// File: frontend/src/types/chat.ts
// Shared chat types across components

export type Msg = {
  id: number | string;
  peerKey: string;
  text?: string | null;
  date?: number | string | null;
  out?: boolean;
  service?: boolean;
};

export type Params = { peerType: string; peerId: string };

// English: format time label consistently
export function timeLabelOf(d?: number | string | null): string {
  if (d == null) return '';
  const ms = typeof d === 'number' ? d : Date.parse(String(d));
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleString();
}
