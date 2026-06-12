"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, getToken, setToken } from "@/lib/api";
import type { AuthResponse, Merchant } from "@/lib/types";

interface AuthState {
  merchant: Merchant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, resolve the current session from the stored token.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<{ merchant: Merchant }>("/dashboard/me")
      .then((res) => setMerchant(res.merchant))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = useCallback((res: AuthResponse) => {
    setToken(res.token);
    setMerchant(res.merchant);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
        anonymous: true,
      });
      handleAuth(res);
    },
    [handleAuth],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await api<AuthResponse>("/auth/register", {
        method: "POST",
        body: { email, password, name },
        anonymous: true,
      });
      handleAuth(res);
    },
    [handleAuth],
  );

  const logout = useCallback(() => {
    setToken(null);
    setMerchant(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ merchant, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
