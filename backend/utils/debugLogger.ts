import fs from "fs";
import path from "path";
import { logger } from "./logger";
const LOG_DIR = path.join(process.cwd(), "debug-logs");
const LOG_FILE = path.join(LOG_DIR, "telegram-debug.log");

/**
 * Ensures that the log directory exists.
 */
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Appends JSON content to logs/telegram-debug.log
 */
export function appendLog(label: string, data: any) {
  try {
    ensureLogDir();

    const entry =
      `\n==== ${label} @ ${new Date().toISOString()} ====\n` +
      JSON.stringify(data, null, 2) +
      "\n===============================================\n";

    fs.appendFileSync(LOG_FILE, entry, "utf8");
  } catch (err) {
    logger.error("Failed to write debug log:", { err });
  }
}

/**
 * Clears the entire log file
 */
export function clearLog() {
  try {
    ensureLogDir();
    fs.writeFileSync(LOG_FILE, "", "utf8");
  } catch (err) {
    logger.error("Failed to clear debug log:", { err });
  }
}
