import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { User } from "../types/user";
import apiClient from "../api/apiClient";
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string | null, user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("authToken")
  );
  const isAuthenticated = Boolean(token);

  useEffect(() => {
    if (!token) return;

    async function fetchUser() {
      try {
        const response = await apiClient.get("/api/me");
        setUser(response.data.user);
      } catch (err) {
        logout();
      }
    }

    fetchUser();
  }, [token]);

  function login(token: string | null, user: User | null) {
    localStorage.setItem("authToken", token!);
    setToken(token);
    setUser(user);
  }
  function logout() {
    localStorage.removeItem("authToken");
    setToken(null);
    setUser(null);
  }
  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
