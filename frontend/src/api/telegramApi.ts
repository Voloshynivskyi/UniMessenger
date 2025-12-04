/**
 * Telegram Authentication API Client for UniMessenger
 *
 * Purpose:
 *   Provides strongly-typed wrappers around all Telegram authentication endpoints.
 *   Encapsulates axios calls and error handling for a clean and scalable frontend architecture.
 *
 * Design goals:
 *   - Fully aligned with backend API contract (status:ok/error)
 *   - Strict TypeScript typing
 *   - Documentation that explains WHY, not just WHAT
 *   - Ready for extension (more providers: Discord, Slack)
 */

import apiClient from "./apiClient";
import { handleApiResponse } from "./handleApiResponse";
import type { NextOffset } from "../types/telegram.types";

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

  // Get latest dialogs without pagination
  async getLatestDialogs(accountId: string) {
    const response = await apiClient.get("/api/telegram/dialogs", {
      params: {
        accountId,
        limit: 50,
      },
    });
    return handleApiResponse(response);
  },

  // Get dialogs with pagination support
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

  /**
   * Fetch message history for a specific Telegram chat.
   */
  async getMessageHistory({
    accountId,
    peerType,
    peerId,
    accessHash,
    limit = 50,
    offsetId = 0,
  }: {
    accountId: string;
    peerType: "user" | "chat" | "channel";
    peerId: string | number | bigint;
    accessHash?: string | number | bigint | null | undefined;
    limit?: number;
    offsetId?: number;
  }) {
    const response = await apiClient.get("/api/telegram/history", {
      params: {
        accountId,
        peerType,
        peerId: String(peerId),
        accessHash:
          accessHash !== undefined && accessHash !== null
            ? String(accessHash)
            : undefined,
        limit,
        offsetId,
      },
    });
    return handleApiResponse(response);
  },

  /**
   * Universal Telegram sender for text-only, media-only, or mixed messages.
   * Frontend always calls ONLY this method.
   * Sends multipart/form-data so controller receives text and optional file.
   */
 async sendMessage(params: {
    accountId: string;
    peerType: "user" | "chat" | "channel";
    peerId: string | number | bigint;
    accessHash?: string | number | bigint | null;
    text: string;
    file?: File;
    mediaKind?: "file" | "voice" | "video_note";
    tempId?: number;
  }) {
    const form = new FormData();

    form.append("accountId", params.accountId);
    form.append("peerType", params.peerType);
    form.append("peerId", String(params.peerId));

    if (params.accessHash !== undefined && params.accessHash !== null) {
      form.append("accessHash", String(params.accessHash));
    }

    form.append("text", params.text ?? "");

    if (typeof params.tempId === "number") {
      form.append("tempId", String(params.tempId));
    }

    if (params.mediaKind) {
      form.append("mediaKind", params.mediaKind);
    }

    if (params.file) {
      form.append("file", params.file);
    }

    const response = await apiClient.post("/api/telegram/sendMessage", form, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return handleApiResponse<{
      tempId?: number;
      realMessageId: number;
      date: number;
    }>(response);
  },
};
