import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { SchedulerPost } from "../pages/scheduler/components/list/listUtils";
import {
  dayKey,
  startOfMonth,
  endOfMonth,
} from "../pages/scheduler/components/calendar/calendarUtils";
import { schedulerApi } from "../api/schedulerApi";
import type { ChatTarget } from "../pages/scheduler/components/composer/types";
import { socketClient } from "../realtime/socketClient";
import { useAuth } from "./AuthContext";

/**
 * Details DTO (from schedulerApi.getPost)
 * Keep it local to context to avoid type-cycles.
 */
export interface SchedulerPostTargetDTO {
  id: string;
  platform: "telegram" | "discord";
  title: string;
  subtitle?: string;
  status: "pending" | "sent" | "failed";
  lastError?: string | null;
}

export interface SchedulerPostDetailsDTO {
  id: string;
  text: string;
  scheduledAt: string; // ISO
  status: SchedulerPost["status"];
  targets: SchedulerPostTargetDTO[];
}

interface SchedulerContextValue {
  // List / calendar data (compact)
  posts: SchedulerPost[];
  loading: boolean;
  error: string | null;

  selectedDate: Date;
  monthCursor: Date;

  setSelectedDate: (d: Date) => void;
  setMonthCursor: (d: Date) => void;

  postsForSelectedDate: SchedulerPost[];

  loadPostsForMonth: (cursor: Date) => Promise<void>;

  createPost: (input: {
    text: string;
    scheduledAt: string;
    targets: ChatTarget[];
  }) => Promise<void>;

  deletePost: (id: string) => Promise<void>;
  cancelPost: (id: string) => Promise<void>;
  retryPost: (id: string) => Promise<void>;

  // Drawer / details
  drawerOpen: boolean;
  selectedPostId: string | null;
  selectedPost: SchedulerPostDetailsDTO | null;
  detailsLoading: boolean;

  openPost: (id: string) => Promise<void>;
  closePost: () => void;
  refreshSelectedPost: () => Promise<void>;
}

const SchedulerContext = createContext<SchedulerContextValue | null>(null);

function monthRangeISO(cursor: Date) {
  const from = startOfMonth(cursor);
  const to = endOfMonth(cursor);

  return {
    fromISO: new Date(from.getFullYear(), from.getMonth(), 1).toISOString(),
    toISO: new Date(
      to.getFullYear(),
      to.getMonth(),
      to.getDate(),
      23,
      59,
      59,
      999
    ).toISOString(),
  };
}

export function SchedulerProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();

  const [posts, setPosts] = useState<SchedulerPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthCursor, setMonthCursor] = useState(new Date());

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] =
    useState<SchedulerPostDetailsDTO | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadPostsForMonth = useCallback(async (cursor: Date) => {
    setLoading(true);
    setError(null);

    const { fromISO, toISO } = monthRangeISO(cursor);

    try {
      const apiPosts = await schedulerApi.listPosts({
        from: fromISO,
        to: toISO,
      });
      setPosts(apiPosts);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load scheduler posts");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSelectedPost = useCallback(async () => {
    if (!selectedPostId) return;
    setDetailsLoading(true);
    try {
      const details = await schedulerApi.getPost(selectedPostId);
      setSelectedPost(details);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load post details");
    } finally {
      setDetailsLoading(false);
    }
  }, [selectedPostId]);

  const openPost = useCallback(async (id: string) => {
    setDrawerOpen(true);
    setSelectedPostId(id);
    setSelectedPost(null);
    setDetailsLoading(true);

    try {
      const details = await schedulerApi.getPost(id);
      setSelectedPost(details);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load post details");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const closePost = useCallback(() => {
    setDrawerOpen(false);
    setSelectedPostId(null);
    setSelectedPost(null);
    setDetailsLoading(false);
  }, []);

  // realtime
  useEffect(() => {
    if (!token) return;

    socketClient.connect(token);

    const handler = (payload?: any) => {
      // Always refresh month list (cheap enough for now)
      void loadPostsForMonth(monthCursor);

      // If drawer is open for the same post, refresh details too
      const postId = payload?.postId;
      if (drawerOpen && selectedPostId && postId && postId === selectedPostId) {
        void refreshSelectedPost();
      }
    };

    socketClient.on("scheduler:post_updated", handler);
    return () => socketClient.off("scheduler:post_updated", handler);
  }, [
    token,
    monthCursor,
    loadPostsForMonth,
    drawerOpen,
    selectedPostId,
    refreshSelectedPost,
  ]);

  const postsForSelectedDate = useMemo(() => {
    const key = dayKey(selectedDate);
    return posts
      .filter((p) => dayKey(new Date(p.scheduledAt)) === key)
      .slice()
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
  }, [posts, selectedDate]);

  const createPost: SchedulerContextValue["createPost"] = async ({
    text,
    scheduledAt,
    targets,
  }) => {
    setError(null);

    const optimistic: SchedulerPost = {
      id: `tmp-${crypto.randomUUID()}`,
      text,
      scheduledAt,
      status: "scheduled",
      targetsCount: targets.length,
    };

    setPosts((prev) =>
      [...prev, optimistic].sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      )
    );

    try {
      const created = await schedulerApi.createPost({
        text,
        scheduledAt,
        targets: targets.map((t) =>
          t.platform === "telegram"
            ? {
                platform: "telegram",
                telegramAccountId: t.accountId,
                peerType: t.peerType ?? "user",
                peerId: t.chatId,
                accessHash: t.accessHash ?? null,
              }
            : {
                platform: "discord",
                discordBotId: t.accountId,
                channelId: t.chatId,
                threadId: t.threadId ?? null,
              }
        ),
      });

      setPosts((prev) =>
        prev.map((p) => (p.id === optimistic.id ? created : p))
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to create post");
      setPosts((prev) => prev.filter((p) => p.id !== optimistic.id));
    }
  };

  const deletePost = async (id: string) => {
    await schedulerApi.deletePost(id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (selectedPostId === id) closePost();
  };

  const cancelPost = async (id: string) => {
    const updated = await schedulerApi.cancelPost(id);
    setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    if (selectedPostId === id) await refreshSelectedPost();
  };

  const retryPost = async (id: string) => {
    const updated = await schedulerApi.retryPost(id);
    setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    if (selectedPostId === id) await refreshSelectedPost();
  };

  return (
    <SchedulerContext.Provider
      value={{
        posts,
        loading,
        error,
        selectedDate,
        monthCursor,
        setSelectedDate,
        setMonthCursor,
        postsForSelectedDate,
        loadPostsForMonth,
        createPost,
        deletePost,
        cancelPost,
        retryPost,

        drawerOpen,
        selectedPostId,
        selectedPost,
        detailsLoading,
        openPost,
        closePost,
        refreshSelectedPost,
      }}
    >
      {children}
    </SchedulerContext.Provider>
  );
}

export function useScheduler() {
  const ctx = useContext(SchedulerContext);
  if (!ctx)
    throw new Error("useScheduler must be used inside SchedulerProvider");
  return ctx;
}
