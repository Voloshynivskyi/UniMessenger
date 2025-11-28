// backend/realtime/handlers/onRawUpdate.ts

import { logger } from "../../utils/logger";
import {
  telegramUpdateHandlers,
  isTelegramUpdateType,
  type TelegramUpdateType,
} from "../telegramUpdateHandlers";

/**
 * Handles raw Telegram update events
 *
 * This handler processes raw MTProto update events from Telegram by identifying the update type
 * and routing it to the appropriate specialized handler. It acts as a dispatcher for various
 * Telegram update types (typing, read status, deletions, etc.) that don't represent full messages.
 *
 * @param update - The raw Telegram update object
 * @param accountId - The Telegram account ID that received this update
 * @param userId - The UniMessenger user ID who owns the account
 */
export async function onRawUpdate(
  update: any,
  accountId: string,
  userId: string
) {
  try {
    const raw = update?.update ?? update;
    const className =
      raw?.className ?? raw?.constructor?.name ?? "UNKNOWN_RAW_TYPE";

    // logger.info("=== [onRawUpdate] RAW EVENT ===");
    // logger.info(`accountId=${accountId}, userId=${userId}`);
    // logger.info(`[onRawUpdate] raw class = ${className}`);
    // logger.info("[onRawUpdate] keys:", Object.keys(raw || {}));

    if (!className || !isTelegramUpdateType(className)) {
      // This is a raw update we don't handle yet (can be safely ignored)
      return;
    }

    const handler = telegramUpdateHandlers[className as TelegramUpdateType];
    if (!handler) {
      logger.warn(`[onRawUpdate] No handler for ${className}`);
      return;
    }

    await handler({ update: raw, accountId, userId });
  } catch (err) {
    logger.error("[onRawUpdate] ERROR:", { err });
  }
}
