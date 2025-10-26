/**
 * authApi.ts
 * Frontend API layer for user authentication (register, login, get current user).
 * Ensures consistent response format and centralized error handling.
 */

import apiClient from "./apiClient";
import { handleApiResponse } from "./handleApiResponse";

export interface UniAuthUser {
  id: string;
  email: string;
  displayName?: string | null;
  createdAt: string;
}

export interface AuthSuccessResponse {
  token: string;
  user: UniAuthUser;
}

export const authApi = {
  /**
   * Register a new user and receive a JWT token
   */
  async register(
    email: string,
    password: string,
    displayName?: string
  ): Promise<AuthSuccessResponse> {
    const response = await apiClient.post("/api/auth/register", {
      email,
      password,
      name: displayName,
    });
    return handleApiResponse(response);
  },

  /**
   * Login an existing user
   */
  async login(email: string, password: string): Promise<AuthSuccessResponse> {
    const response = await apiClient.post("/api/auth/login", {
      email,
      password,
    });
    return handleApiResponse(response);
  },

  /**
   * Get current authenticated user data using token from headers
   */
  async getCurrentUser(): Promise<UniAuthUser> {
    const response = await apiClient.get("/api/me");
    const data = handleApiResponse(response);
    return data.user;
  },
};
