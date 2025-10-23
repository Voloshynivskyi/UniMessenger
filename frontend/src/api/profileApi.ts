/**
 * userApi.ts
 * 👤 API client for user-related operations (profile, settings, etc.)
 *
 * 🎯 Purpose:
 *  - Provides a clean abstraction for interacting with the authenticated user endpoint
 *  - Avoids direct axios usage in components or context
 *  - Ensures unified error handling via ApiError
 */

import apiClient from "./apiClient";
import { handleApiResponse } from "./handleApiResponse";

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string | null;
  createdAt: string;
}

export const profileApi = {
  /**
   * Retrieves current user profile based on Bearer token in headers.
   * Used by AuthContext and other components to get user data.
   *
   * @returns UserProfile
   * @throws ApiError if unauthorized or token invalid
   */
  async getMe(): Promise<UserProfile> {
    const response = await apiClient.get("/api/me");
    return handleApiResponse(response);
  },
};