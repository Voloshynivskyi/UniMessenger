// frontend/src/pages/scheduler/components/list/listUtils.ts

export type SchedulerPostStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "canceled";

export interface SchedulerPost {
  id: string;
  text: string;
  scheduledAt: string; // ISO
  status: SchedulerPostStatus;

  /** compact: used by list/calendar */
  targetsCount: number;
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}
