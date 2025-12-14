// frontend/src/types/scheduler.types.ts
import type { SchedulerPostStatus } from "../pages/scheduler/components/list/listUtils";
export type SchedulerPlatform = "telegram" | "discord" | "slack";

export type ScheduledPostStatus = "draft" | "scheduled" | "sent" | "failed";

export interface ScheduledTarget {
  id: string;
  platform: SchedulerPlatform;
  accountId: string;
  chatId: string;
  chatTitle?: string;
}

export interface ScheduledPost {
  id: string;
  text: string;
  status: ScheduledPostStatus;
  scheduledAt: string | null; // ISO string
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  targets: ScheduledTarget[];
  mediaCount?: number; // placeholder for future
}

export interface SchedulerPostTargetDetails {
  id: string;
  platform: "telegram" | "discord";
  status: "pending" | "sent" | "failed";
  lastError: string | null;

  telegramAccountId?: string | null;
  peerType?: "user" | "chat" | "channel" | null;
  peerId?: string | null;
  accessHash?: string | null;

  discordBotId?: string | null;
  channelId?: string | null;
  threadId?: string | null;
}

export interface SchedulerPostDetails {
  id: string;
  text: string;
  scheduledAt: string;
  status: SchedulerPostStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  targets: SchedulerPostTargetDetails[];
}
