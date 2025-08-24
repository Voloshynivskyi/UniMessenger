// backend/routes/telegramHealth.ts
import { Router, Request, Response } from 'express';
import { StringSession } from 'telegram/sessions';
import crypto from 'crypto';

import { sessionManager } from '../services/sessionManager';
import { getSessionStringFor } from '../services/telegramAuthService';

const router = Router();

/** Take short SHA1 fingerprint for displaying/compare */
function fp(input: string | null | undefined): string | null {
  if (!input) return null;
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 12);
}

/**
 * Best-effort decrypt of sessionString from DB.
 * Якщо в utils/crypto є decrypt — використаємо.
 * Якщо ні або кине помилку — повертаємо null (тоді порівняємо raw).
 */
async function tryDecryptSessionString(enc: string | null | undefined): Promise<string | null> {
  if (!enc) return null;
  try {
    // optional dynamic import to avoid hard-compile dependency if decrypt не експортиться
    const mod = await import('../utils/crypto');
    const dec = (mod as any)?.decrypt as undefined | ((s: string) => string);
    if (typeof dec === 'function') {
      return dec(enc);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * GET /api/telegram/health?sessionId=...
 *
 * Відповідає:
 * {
 *   sessionId: string,
 *   hasClient: boolean,
 *   connected: boolean,
 *   storedPresent: boolean,
 *   activeFingerprint: string | null,
 *   storedFingerprint: string | null,        // по можливості з розшифруванням
 *   storedFingerprintRaw: string | null,     // fingerprint шифротексту (на випадок, якщо розшифрування недоступне)
 *   fingerprintsMatch: boolean | null,       // true/false, якщо є обидва; null — якщо порівнювати неможливо
 *   notes: string[]
 * }
 */
router.get('/telegram/health', async (req: Request, res: Response) => {
  const sessionId =
    String(req.query.sessionId ?? req.headers['x-session-id'] ?? '').trim();

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const notes: string[] = [];

  // 1) Дістаємо збережений рядок сесії з БД
  const storedEnc = await getSessionStringFor(sessionId);
  const storedPresent = Boolean(storedEnc);

  // 2) Пробуємо розшифрувати (якщо є decrypt). Якщо не вийде — зробимо raw fingerprint.
  const storedDec = await tryDecryptSessionString(storedEnc).catch(() => null);

  const storedFingerprint = fp(storedDec ?? undefined);
  const storedFingerprintRaw = fp(storedEnc ?? undefined);
  if (storedDec == null && storedEnc) {
    notes.push('Розшифрувати sessionString не вдалося — показуємо fingerprint за шифротекстом (storedFingerprintRaw).');
  }

  // 3) Пробуємо отримати довгоживучий клієнт
  //    Якщо ensureClient у вас створює новий клієнт за потреби — це окей для health;
  //    Якщо ви НЕ хочете автосоздання — реалізуйте sessionManager.peek(sessionId) і використайте її тут замість ensureClient.
  let client: any = null;
  try {
    client = await sessionManager.ensureClient(sessionId);
  } catch (e: any) {
    notes.push(`ensureClient error: ${e?.message || String(e)}`);
  }

  const hasClient = Boolean(client);
  const connected = Boolean(client?.connected ?? false);

  // 4) Активний fingerprint із клієнта (plaintext StringSession)
  let activeFingerprint: string | null = null;
  try {
    const ss = client?.session as StringSession | undefined;
    const plain = ss?.save?.();
    activeFingerprint = fp(plain);
  } catch {
    // ignore
  }

  // 5) Порівняння
  let fingerprintsMatch: boolean | null = null;
  if (activeFingerprint && storedFingerprint) {
    fingerprintsMatch = activeFingerprint === storedFingerprint;
  } else if (activeFingerprint && !storedFingerprint && storedFingerprintRaw) {
    // fallback порівняння із raw (ймовірно НЕ співпаде, бо це fingerprint шифротексту)
    fingerprintsMatch = activeFingerprint === storedFingerprintRaw;
    if (fingerprintsMatch) {
      notes.push('Співпадіння виконане з raw fingerprint (ймовірно шифротекст). Перевірте decrypt().');
    }
  }

  res.json({
    sessionId,
    hasClient,
    connected,
    storedPresent,
    activeFingerprint,
    storedFingerprint,     // fingerprint plaintext (якщо вдалося розшифрувати)
    storedFingerprintRaw,  // fingerprint шифрованого рядка (на випадок відсутності decrypt)
    fingerprintsMatch,
    notes,
  });
});

export default router;