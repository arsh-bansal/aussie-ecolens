import { createContext } from "react";

export type AuthUser = {
  email: string;
  firstName: string;
  lastName: string;
  sub: string;
};

export type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  getIdToken: () => string | null;
  signUp: (email: string, firstName: string, lastName: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmPassword: (email: string, code: string, newPassword: string) => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);
