/**
 * AuthContext.tsx
 * 🌐 Global authentication context for UniMessenger frontend application.
 *
 * 🎯 Responsibilities:
 *  - Store and provide auth state (user + token)
 *  - Handle login/logout operations
 *  - Automatically fetch user profile if token exists
 *  - Expose `isAuthenticated` flag to protect routes
 *
 * ✅ Uses centralized API layer (authApi) instead of direct axios calls.
 * ✅ Uses localStorage only for token persistence.
 * ✅ Follows production-grade architecture used in scalable SaaS apps.
 */

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { UniAuthUser} from "../api/authApi";
import { authApi } from "../api/authApi";
import { ApiError } from "../api/ApiError";

export interface AuthContextType {
  user: UniAuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UniAuthUser | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("authToken")
  );
  const isAuthenticated = Boolean(token);

  /**
   * Load user profile if token exists in localStorage on startup.
   */
  useEffect(() => {
    if (!token) return;
    refreshUser();
  }, [token]);

  /**
   * Refresh authenticated user by calling backend /api/me.
   * If token invalid or expired, logout is executed automatically.
   */
  async function refreshUser() {
    try {
      const user = (await authApi.getCurrentUser()) as UniAuthUser;

      setUser(user);
    } catch (err) {
      console.warn("[AuthContext] Failed to refresh user:", err);
      logout();
    }
  }

  /**
   * Perform login via backend API.
   * Stores token and user in state + localStorage.
   */
  async function login(email: string, password: string) {
    try {
      const { token, user } = await authApi.login(email, password);
      setToken(token);
      setUser(user);
      localStorage.setItem("authToken", token);
    } catch (err) {
      if (err instanceof ApiError) {
        throw err; // Let UI handle the error message (e.g. incorrect password)
      }
      throw new Error("Login failed due to unexpected error");
    }
  }
  /**
   * Perform user registration via backend API.
   * Stores token and user in state + localStorage.
   */
  async function register(email: string, password: string) {
    try {
      const { token, user } = await authApi.register(email, password);
      localStorage.setItem("authToken", token);
      setToken(token);
      setUser(user);
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new Error("Registration failed due to unexpected error");
    }
  }

  /**
   * Clear user data and remove token.
   */
  function logout() {
    localStorage.removeItem("authToken");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
