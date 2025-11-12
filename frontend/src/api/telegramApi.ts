/**
 * Telegram Authentication API Client for UniMessenger
 *
 * 🚀 Purpose:
 *   Provides strongly-typed wrappers around all Telegram authentication endpoints.
 *   Encapsulates axios calls and error handling for a clean and scalable frontend architecture.
 *
 * 🧠 Design goals:
 *   - Fully aligned with backend API contract (`status:ok/error`)
 *   - Strict TypeScript typing
 *   - Documentation that explains WHY, not just WHAT
 *   - Ready for extension (more providers: Discord, Slack)
 */

import apiClient from "./apiClient";
import { handleApiResponse } from "./handleApiResponse";
import type { NextOffset, UnifiedTelegramChat } from "../types/telegram.types";
/** Data returned after /sendCode */
export interface SendCodeResult {
  phoneCodeHash: string;
  tempSession: string;
}

/** Data returned when user is successfully authenticated */
export interface SignInSuccessResult {
  operationStatus: "account_created" | "session_replaced";
  telegramId: string;
  accountId: string;
  username: string | null;
  phoneNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
}

/** Data returned when Telegram requires a 2FA password */
export interface SignInNeedPasswordResult {
  needsPassword: true;
  tempSession: string;
}

/** Union of possible outcomes of signIn */
export type SignInResult = SignInSuccessResult | SignInNeedPasswordResult;

export interface TelegramAuthAccount {
  accountId: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  isActive: boolean;
}

/**
 * Wrapper object for all Telegram-related API operations.
 * Every function returns either specific typed data or throws ApiError.
 */
export const telegramApi = {
  /**
   * Step 1: Request Telegram to send a verification code.
   *
   * @param phoneNumber - Must be in full international format (e.g. +380931234567)
   * @returns {SendCodeResult} The phoneCodeHash and tempSession, required for next step.
   * @throws {ApiError} If phone is invalid or service is rate-limited (FLOOD_WAIT).
   */
  async sendCode(phoneNumber: string): Promise<SendCodeResult> {
    const response = await apiClient.post("/api/telegram/sendCode", {
      phoneNumber,
    });
    return handleApiResponse(response);
  },

  /**
   * Step 2: Verify the code sent to phone.
   *
   * @param phoneNumber - User's phone
   * @param phoneCode - SMS code from Telegram
   * @param phoneCodeHash - Hash returned from sendCode
   * @param tempSession - Temporary session string returned from sendCode
   *
   * @returns {SignInResult}
   *   - If 2FA is not required → SignInSuccessResult
   *   - If 2FA is required → SignInNeedPasswordResult
   */
  async signIn(
    phoneNumber: string,
    phoneCode: string,
    phoneCodeHash: string,
    tempSession: string
  ): Promise<SignInResult> {
    const response = await apiClient.post("/api/telegram/signIn", {
      phoneNumber,
      phoneCode,
      phoneCodeHash,
      tempSession,
    });
    return handleApiResponse(response);
  },

  /**
   * Step 3: Complete authentication using Telegram password (2FA)
   *
   * @param tempSession - Session obtained after code confirmation
   * @param password - User's Telegram 2FA password
   *
   * @returns {SignInSuccessResult} Always successful if credentials correct.
   * @throws {ApiError} If password is incorrect or session expired.
   */
  async verifyTwoFA(
    tempSession: string,
    password: string
  ): Promise<SignInSuccessResult> {
    const response = await apiClient.post("/api/telegram/2fa", {
      tempSession,
      password,
    });
    return handleApiResponse(response);
  },

  /**
   * Get all connected Telegram accounts for the authenticated user.
   *
   * @returns Array of account objects with status and user details.
   */
  async getAccounts(): Promise<TelegramAuthAccount[]> {
    const response = await apiClient.get("/api/telegram/accounts");
    const data = handleApiResponse<{ accounts: TelegramAuthAccount[] }>(
      response
    );
    return data.accounts;
  },

  /**
   * Disconnect (log out) a Telegram account from the current user.
   */
  async logout(accountId: string) {
    const response = await apiClient.post("/api/telegram/logout", {
      accountId,
    });
    return handleApiResponse(response);
  },

  async getLatestDialogs(accountId: string) {
    const response = await apiClient.get("/api/telegram/dialogs", {
      params: {
        accountId,
        limit: 50,
      },
    });
    return handleApiResponse(response);
  },

  async getDialogs(accountId: string, nextOffset?: NextOffset | null) {
    const params: any = { accountId, limit: 50 };

    if (nextOffset) {
      params.offsetDate = nextOffset.offsetDate;
      params.offsetId = nextOffset.offsetId;
      if (nextOffset.offsetPeer) {
        params.offsetPeerId = nextOffset.offsetPeer.id;
        params.offsetPeerType = nextOffset.offsetPeer.type;
        if (nextOffset.offsetPeer.accessHash) {
          params.offsetPeerAccessHash = nextOffset.offsetPeer.accessHash;
        }
      }
    }

    const response = await apiClient.get("/api/telegram/dialogs", { params });
    return handleApiResponse(response);
  },
};
