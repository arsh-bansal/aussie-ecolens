'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  confirmForgotPassword,
  confirmSignUp,
  forgotPassword,
  getCurrentSession,
  getUserAttributes,
  resendConfirmationCode,
  signIn,
  signOut,
  signUp,
  type SignUpParams,
} from '@/lib/cognito';
import type { AuthUser } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (params: SignUpParams) => Promise<void>;
  verify: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  logout: () => void;
  sendResetCode: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const { session } = await getCurrentSession();
      if (session.isValid()) {
        const attrs = await getUserAttributes();
        setUser({
          sub: attrs['sub'] ?? '',
          email: attrs['email'] ?? '',
          given_name: attrs['given_name'],
          family_name: attrs['family_name'],
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email: string, password: string) => {
    await signIn(email, password);
    await loadUser();
  };

  const register = async (params: SignUpParams) => {
    await signUp(params);
  };

  const verify = async (email: string, code: string) => {
    await confirmSignUp(email, code);
  };

  const resendCode = async (email: string) => {
    await resendConfirmationCode(email);
  };

  const logout = () => {
    signOut();
    setUser(null);
  };

  const sendResetCode = async (email: string) => {
    await forgotPassword(email);
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    await confirmForgotPassword(email, code, newPassword);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        verify,
        resendCode,
        logout,
        sendResetCode,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const AUTH_FALLBACK: AuthContextValue = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  verify: async () => {},
  resendCode: async () => {},
  logout: () => {},
  sendResetCode: async () => {},
  resetPassword: async () => {},
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext) ?? AUTH_FALLBACK;
}
