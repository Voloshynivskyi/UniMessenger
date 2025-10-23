// backend/utils/logger.ts

/**
 * Lightweight logger with structured output.
 * Can be replaced later by Winston, Pino, Datadog, etc.
 */

interface LogPayload {
  [key: string]: any;
}

function formatMessage(level: string, message: string, payload?: LogPayload) {
  const time = new Date().toISOString();
  if (payload) {
    return `[${time}] [${level.toUpperCase()}] ${message} | ${JSON.stringify(
      payload
    )}`;
  }
  return `[${time}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  info(message: string, payload?: LogPayload) {
    console.log(formatMessage("info", message, payload));
  },
  warn(message: string, payload?: LogPayload) {
    console.warn(formatMessage("warn", message, payload));
  },
  error(message: string, payload?: LogPayload) {
    console.error(formatMessage("error", message, payload));
  },
  debug(message: string, payload?: LogPayload) {
    if (process.env.NODE_ENV === "development") {
      console.debug(formatMessage("debug", message, payload));
    }
  },
};
