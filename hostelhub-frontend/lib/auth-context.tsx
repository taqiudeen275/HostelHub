"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { authApi, type User, type UserRole, type TokenPair, tokenStorage } from "./api";

// ─── Context shape ───────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (tokens: TokenPair, user: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from backend on mount (if we have a stored token)
  useEffect(() => {
    const token = tokenStorage.getAccess();
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        tokenStorage.clear();
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Listen for auth:expired event from the API client (refresh failed)
  useEffect(() => {
    const handler = () => {
      setUser(null);
      tokenStorage.clear();
    };
    window.addEventListener("hh:auth:expired", handler);
    return () => window.removeEventListener("hh:auth:expired", handler);
  }, []);

  const login = useCallback((tokens: TokenPair, userData: User) => {
    tokenStorage.setTokens(tokens.access, tokens.refresh);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefresh();
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        // Ignore logout errors — we clear locally regardless
      }
    }
    tokenStorage.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await authApi.me();
      setUser(u);
    } catch {
      // If this fails, token is gone — auth:expired event will handle it
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}

// ─── Convenience role helpers ─────────────────────────────────────────────────

export function useRequireRole(role: UserRole) {
  const { user, isLoading } = useAuth();
  return {
    user,
    isLoading,
    hasRole: user?.role === role,
  };
}
