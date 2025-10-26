/**
 * frontend/src/context/TelegramAccountContext.tsx
 * React context for managing Telegram account state and operations
 */

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { telegramApi } from "../api/telegramApi";
import { ApiError } from "../api/ApiError";
import type {
  TelegramAuthAccount,
  SendCodeResult,
  SignInResult,
} from "../api/telegramApi";

export interface TelegramContextType {
  accounts: TelegramAuthAccount[] | null;
  loading: boolean;
  error: string | null;
  sendCode: (phoneNumber: string) => Promise<SendCodeResult>;
  signIn: (
    phoneNumber: string,
    phoneCode: string,
    phoneCodeHash: string,
    tempSession: string
  ) => Promise<SignInResult>;
  verifyTwoFA: (tempSession: string, password: string) => Promise<SignInResult>;
  logoutAccount: (accountId: string) => void;
  refreshAccounts: () => Promise<void>;
}

const TelegramContext = createContext<TelegramContextType | null>(null);

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<TelegramAuthAccount[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load user profile if token exists in localStorage on startup.
   */
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      refreshAccounts();
    } else {
      setAccounts(null);
      setError("User is not authenticated");
    }
  }, []);

  /**
   * Refresh users authenticated telegram accounts by calling backend /api/telegram/accounts.
   */
  async function refreshAccounts() {
    try {
      const accounts =
        (await telegramApi.getAccounts()) as TelegramAuthAccount[];

      setAccounts(accounts);
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new Error("Failed to refresh accounts due to unexpected error");
    }
  }

  /**
   * Step 1: Send code to user's phone number via backend API.
   * @param phoneNumber - Full international format (e.g. +380931234567)
   * @returns {SendCodeResult} phoneCodeHash and tempSession for next step.
   * @throws {ApiError} If phone is invalid or service is rate-limited (FLOOD_WAIT).
   */
  async function sendCode(phoneNumber: string) {
    try {
      const response = await telegramApi.sendCode(phoneNumber);
      return response;
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new Error("Failed to send code due to unexpected error");
    }
  }
  /**
   * Step 2: Sign in user by confirming code via backend API.
   * @param phoneNumber - User's phone
   * @param phoneCode - SMS code from Telegram
   * @param phoneCodeHash - Hash returned from sendCode
   * @param tempSession - Temporary session string returned from sendCode
   * @returns {SignInResult}
   *   - If 2FA is not required → SignInSuccessResult
   *   - If 2FA is required → SignInNeedPasswordResult
   * @throws {ApiError} If code is incorrect or session expired.
   */
  async function signIn(
    phoneNumber: string,
    phoneCode: string,
    phoneCodeHash: string,
    tempSession: string
  ): Promise<SignInResult> {
    setLoading(true);
    setError(null);
    try {
      const response = await telegramApi.signIn(
        phoneNumber,
        phoneCode,
        phoneCodeHash,
        tempSession
      );

      if ("needsPassword" in response) {
        setLoading(false);
        return response;
      }

      const newAccount: TelegramAuthAccount = {
        accountId: response.accountId,
        telegramId: response.telegramId,
        username: response.username,
        firstName: response.firstName,
        lastName: response.lastName,
        phoneNumber: response.phoneNumber,
        isActive: response.isActive,
      };

      setAccounts((prev) => {
        if (!prev) return [newAccount];
        const exists = prev.some(
          (acc) => acc.accountId === newAccount.accountId
        );
        return exists
          ? prev.map((acc) =>
              acc.accountId === newAccount.accountId ? newAccount : acc
            )
          : [...prev, newAccount];
      });

      setLoading(false);
      return response;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        throw err;
      }
      setError("Unexpected error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Step 3: Verify 2FA password via backend API.
   * @param tempSession - Temporary session string returned from signIn
   * @param password - User's 2FA password
   * @returns {SignInResult}
   *   - If successful → SignInSuccessResult
   * @throws {ApiError} If password is incorrect or session expired.
   */

  async function verifyTwoFA(
    tempSession: string,
    password: string
  ): Promise<SignInResult> {
    setLoading(true);
    setError(null);
    try {
      const response = await telegramApi.verifyTwoFA(tempSession, password);

      setAccounts((prev) => {
        const newAccount: TelegramAuthAccount = {
          accountId: response.accountId,
          telegramId: response.telegramId,
          username: response.username,
          firstName: response.firstName,
          lastName: response.lastName,
          phoneNumber: response.phoneNumber,
          isActive: response.isActive,
        };
        if (!prev) return [newAccount];

        const exists = prev.some(
          (acc) => acc.accountId === newAccount.accountId
        );
        return exists
          ? prev.map((acc) =>
              acc.accountId === newAccount.accountId ? newAccount : acc
            )
          : [...prev, newAccount];
      });
      return response;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        throw err;
      }
      setError("Failed to verify 2FA due to unexpected error");
      throw new Error("Failed to verify 2FA due to unexpected error");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Clear user data and remove token.
   */
  async function logoutAccount(accountId: string) {
    setLoading(true);
    setError(null);
    try {
      await telegramApi.logout(accountId);
      setAccounts((prev) =>
        prev ? prev.filter((acc) => acc.accountId !== accountId) : null
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        throw err;
      }
      setError("Failed to logout account due to unexpected error");
      throw new Error("Failed to logout account due to unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <TelegramContext.Provider
      value={{
        accounts,
        loading,
        error,
        sendCode,
        signIn,
        verifyTwoFA,
        logoutAccount,
        refreshAccounts,
      }}
    >
      {children}
    </TelegramContext.Provider>
  );
}

/**
 * Hook to access authentication context
 */
export function useTelegram() {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error("useTelegram must be used within a TelegramProvider");
  }
  return context;
}
