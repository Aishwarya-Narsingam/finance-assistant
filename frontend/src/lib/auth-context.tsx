"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "./api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string | null;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  onboardingDone: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, mfaToken?: string) => Promise<any>;
  register: (data: { email: string; password: string; name: string }) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      if (data.success && data.data?.user) {
        setUser(data.data.user);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  const login = async (email: string, password: string, mfaToken?: string) => {
    const { data } = await authApi.login({ email, password, mfaToken });
    if (data.data?.accessToken) {
      localStorage.setItem("accessToken", data.data.accessToken);
      setUser(data.data.user);
    }
    return data;
  };

  const register = async (regData: { email: string; password: string; name: string }) => {
    const { data } = await authApi.register(regData);
    if (data.data?.accessToken) {
      localStorage.setItem("accessToken", data.data.accessToken);
      setUser(data.data.user);
    }
    return data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors
    } finally {
      localStorage.removeItem("accessToken");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
