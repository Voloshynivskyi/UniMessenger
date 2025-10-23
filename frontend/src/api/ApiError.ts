/**
 * Custom error class for handling API-level errors in the UniMessenger frontend.
 *
 * 🌐 Purpose:
 *  - Provides a uniform structure for all server-side errors
 *  - Enables components and hooks to distinguish between validation errors,
 *    authentication issues, or integration-specific failures (e.g. Telegram FLOOD_WAIT)
 *  - Designed to scale for multiple messaging providers (Telegram, Discord, Slack)
 *
 * 🧠 Usage:
 *  throw new ApiError("BAD_CREDENTIALS", "Invalid login credentials", 401);
 *
 * 🚦 Handled in UI:
 *  try { ... } catch(err) {
 *    if (err instanceof ApiError) { showToast(err.message) }
 *  }
 */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "BAD_CREDENTIALS"
  | "VALIDATION_ERROR"
  | "USER_EXISTS"
  | "USER_NOT_FOUND"
  | "TOKEN_EXPIRED"
  | "FLOOD_WAIT"
  | "PHONE_NUMBER_INVALID"
  | "TELEGRAM_SERVICE_ERROR"
  | "UNEXPECTED";

export class ApiError extends Error {
  /** Short machine-readable identifier for the error */
  public code: ApiErrorCode;

  /** HTTP status code returned by the server */
  public httpStatus: number;

  /** Optional array of validation errors (e.g. ["Password too short", "Email invalid"]) */
  public details?: string[];

  /** Optional retry timer (used for Telegram FLOOD_WAIT rate limiting) */
  public retryAfter?: number;

  /**
   * Construct a new ApiError instance
   * @param code - Stable identifier for this error type, used for switch logic in the UI
   * @param message - Human-friendly error message (can be shown to the user)
   * @param httpStatus - HTTP code from server response, defaults to 400
   * @param options - Optional extra metadata
   */
  constructor(
    code: ApiErrorCode,
    message: string,
    httpStatus = 400,
    options?: {
      details?: string[];
      retryAfter?: number;
    }
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    if (options?.details) this.details = options.details;
    if (options?.retryAfter) this.retryAfter = options.retryAfter;
  }
}
