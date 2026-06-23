'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setAccessToken, getAccessToken } from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  image?: string | null;
  role: string;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  onboardingDone: boolean;
  provider?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<any>;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email', '/auth/callback', '/'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        setUser(null);
        return;
      }
      const { data } = await authApi.me();
      // Normalize avatar/image field
      setUser({
        ...data.user,
        image: data.user.avatar || data.user.image,
        avatar: data.user.avatar || data.user.image,
      });
    } catch {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const token = getAccessToken();
      if (token) {
        await refreshUser();
      }
      setLoading(false);
    };
    init();
  }, [refreshUser]);

  // Redirect based on auth state
  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) || pathname === '/';
    const isOnboarding = pathname.startsWith('/onboarding');
    const isCallback = pathname.startsWith('/auth/callback');

    if (!user) {
      // Not authenticated - redirect to login unless on a public page
      if (!isPublic && !isCallback) {
        router.push('/auth/login');
      }
    } else {
      // Authenticated
      if (isPublic && pathname !== '/') {
        // Redirect authenticated users away from auth pages
        if (!user.onboardingDone) {
          router.push('/onboarding');
        } else {
          router.push('/dashboard');
        }
      } else if (!user.onboardingDone && !isOnboarding && pathname !== '/dashboard') {
        router.push('/onboarding');
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string, mfaCode?: string) => {
    const { data } = await authApi.login({ email, password, mfaCode });
    if (data.requiresMfa) {
      return { requiresMfa: true };
    }
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  const loginWithGoogle = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    window.location.href = `${apiUrl}/api/auth/google`;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
    router.push('/auth/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        logout,
        refreshUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
