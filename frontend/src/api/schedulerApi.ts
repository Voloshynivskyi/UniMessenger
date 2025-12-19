import apiClient from "./apiClient";
import { handleApiResponse } from "./handleApiResponse";
import type { SchedulerPost } from "../pages/scheduler/components/list/listUtils";

export type SchedulerPostStatus = SchedulerPost["status"];

export interface SchedulerPostDTO {
  id: string;
  text: string;
  scheduledAt: string;
  status: SchedulerPostStatus;
  targetsCount: number;
}

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
  scheduledAt: string;
  status: SchedulerPostStatus;
  targets: SchedulerPostTargetDTO[];
}

function toUI(dto: SchedulerPostDTO): SchedulerPost {
  return {
    id: dto.id,
    text: dto.text,
    scheduledAt: dto.scheduledAt,
    status: dto.status,
    targetsCount: dto.targetsCount,
  };
}

export const schedulerApi = {
  async listPosts(params: {
    from: string;
    to: string;
  }): Promise<SchedulerPost[]> {
    const res = await apiClient.get(
      `/api/scheduler/posts?from=${encodeURIComponent(
        params.from
      )}&to=${encodeURIComponent(params.to)}`
    );
    const data = handleApiResponse<SchedulerPostDTO[]>(res);
    return data.map(toUI);
  },

  async getPost(id: string): Promise<SchedulerPostDetailsDTO> {
    const res = await apiClient.get(`/api/scheduler/posts/${id}`);
    return handleApiResponse<SchedulerPostDetailsDTO>(res);
  },

  async createPost(input: any): Promise<SchedulerPost> {
    const res = await apiClient.post(`/api/scheduler/posts`, input);
    const data = handleApiResponse<SchedulerPostDTO>(res);
    return toUI(data);
  },

  async deletePost(id: string): Promise<void> {
    const res = await apiClient.delete(`/api/scheduler/posts/${id}`);
    handleApiResponse(res);
  },

  async cancelPost(id: string): Promise<SchedulerPost> {
    const res = await apiClient.patch(`/api/scheduler/posts/${id}/cancel`);
    const data = handleApiResponse<SchedulerPostDTO>(res);
    return toUI(data);
  },

  async retryPost(id: string): Promise<SchedulerPost> {
    const res = await apiClient.patch(`/api/scheduler/posts/${id}/retry`);
    const data = handleApiResponse<SchedulerPostDTO>(res);
    return toUI(data);
  },
};
