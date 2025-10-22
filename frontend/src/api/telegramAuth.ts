import apiClient from "./apiClient";

/**
 * Response returned from Telegram sendCode API.
 */
export interface SendCodeResponse {
  status: "code_sent";
  phoneCodeHash: string;
  tempSession: string;
}

/**
 * Custom error used for Telegram authentication flow.
 * Provides clear error codes and optional retry timeout for rate limits.
 */
export class TelegramAuthError extends Error {
  code: string;
  retryAfter?: number;

  constructor(message: string, code: string, retryAfter?: number) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/**
 * Sends a Telegram verification code to the provided phone number.
 *
 * This is the first step in the MTProto authentication flow.
 * On success, the API returns a temporary session and phoneCodeHash
 * required for the next step (signIn).
 *
 * @param phoneNumber - Full phone number in international format (e.g. +380931234567)
 * @returns Object containing phoneCodeHash and tempSession on success
 *
 * @throws TelegramAuthError when:
 *  - Telegram rate limits the user (FLOOD_WAIT)
 *  - The phone number is invalid
 *  - An unexpected server error occurs
 */
export const sendCode = async (
  phoneNumber: string
): Promise<SendCodeResponse> => {
  try {
    const response = await apiClient.post("/api/telegram/sendCode", {
      phoneNumber,
    });

    if (response.data.status === "code_sent") {
      return {
        status: "code_sent",
        phoneCodeHash: response.data.phoneCodeHash,
        tempSession: response.data.tempSession,
      };
    }

    // If response does not match expected schema, treat as unexpected
    throw new TelegramAuthError(
      "Unexpected response from sendCode endpoint.",
      "UNEXPECTED_RESPONSE"
    );
  } catch (error: any) {
    const errData = error?.response?.data;

    // Telegram rate limit
    if (errData?.code === "FLOOD_WAIT") {
      throw new TelegramAuthError(
        "Telegram rate limit exceeded. Please wait before retrying.",
        "FLOOD_WAIT",
        errData.retry_after
      );
    }

    // Invalid phone number error
    if (
      errData?.code === "PHONE_NUMBER_INVALID" ||
      errData?.code === "BAD_PHONE_NUMBER"
    ) {
      throw new TelegramAuthError(
        "Invalid phone number format.",
        "PHONE_NUMBER_INVALID"
      );
    }

    // Default error fallback
    throw new TelegramAuthError(
      errData?.message || "Failed to send verification code.",
      errData?.code || "UNEXPECTED_ERROR"
    );
  }
};
