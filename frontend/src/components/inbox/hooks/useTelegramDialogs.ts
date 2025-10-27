import { useEffect, useState } from "react";
import { telegramApi } from "../../../api/telegramApi";
import type {
  UnifiedTelegramChat,
  NextOffset,
} from "../../../types/telegram.types";
import type { TelegramAuthAccount } from "../../../api/telegramApi";
import { ApiError } from "../../../api/ApiError";

export interface TelegramDialogsPerAccount {
  accountId: string;
  username: string | null;
  dialogs: UnifiedTelegramChat[];
  nextOffset: NextOffset | null;
  loading: boolean;
  error: ApiError | null;
}

export const useTelegramDialogs = (accounts: TelegramAuthAccount[]) => {
  const [data, setData] = useState<TelegramDialogsPerAccount[]>([]);

  useEffect(() => {
    if (!accounts.length) return;

    const initial = accounts.map((acc) => ({
      accountId: acc.accountId,
      username: acc.username || null,
      dialogs: [],
      nextOffset: null,
      loading: true,
      error: null,
    }));
    setData(initial);

    const fetchAll = async () => {
      for (const acc of accounts) {
        try {
          const res = await telegramApi.getLatestDialogs(acc.accountId);
          setData((prev) =>
            prev.map((item) =>
              item.accountId === acc.accountId
                ? {
                    ...item,
                    dialogs: res.dialogs,
                    nextOffset: res.nextOffset || null,
                    loading: false,
                  }
                : item
            )
          );
        } catch (err) {
          const error =
            err instanceof ApiError
              ? err
              : new ApiError("UNEXPECTED", "Failed to load dialogs");
          setData((prev) =>
            prev.map((item) =>
              item.accountId === acc.accountId
                ? { ...item, loading: false, error }
                : item
            )
          );
        }
      }
    };

    fetchAll();
  }, [accounts]);

  const loadMore = async (accountId: string) => {
    const acc = data.find((d) => d.accountId === accountId);
    if (!acc || !acc.nextOffset) return;

    try {
      const res = await telegramApi.getDialogs(accountId, acc.nextOffset);
      setData((prev) =>
        prev.map((item) =>
          item.accountId === accountId
            ? {
                ...item,
                dialogs: [...item.dialogs, ...res.dialogs],
                nextOffset: res.nextOffset || null,
              }
            : item
        )
      );
    } catch (err) {
      const error =
        err instanceof ApiError
          ? err
          : new ApiError("UNEXPECTED", "Failed to load dialogs");
      setData((prev) =>
        prev.map((item) =>
          item.accountId === accountId ? { ...item, error } : item
        )
      );
    }
  };

  return { data, loadMore };
};
