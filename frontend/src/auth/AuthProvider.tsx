import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as cognito from "./cognito";
import { cognitoConfig } from "./config";
import { AuthContext, type AuthState, type AuthUser } from "./AuthContext";

const REFRESH_INTERVAL_MS = 50 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncSession = useCallback(async (showLoading: boolean) => {
    if (!cognitoConfig.isConfigured) {
      if (showLoading) setIsLoading(false);
      return;
    }
    try {
      const result = await cognito.getCurrentSession();
      if (!result) {
        setUser(null);
        setIdToken(null);
        return;
      }
      const attrs = await cognito.getUserAttributes(result);
      setUser({
        email: attrs.email ?? "",
        firstName: attrs.given_name ?? "",
        lastName: attrs.family_name ?? "",
        sub: attrs.sub ?? "",
      });
      setIdToken(result.session.getIdToken().getJwtToken());
    } catch (err) {
      console.warn("session refresh failed", err);
      setUser(null);
      setIdToken(null);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // setState here happens after an async boundary, so the cascading-render
    // warning in react-hooks/set-state-in-effect doesn't apply. Initial
    // load-on-mount is the canonical useEffect use case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void syncSession(true);
  }, [syncSession]);

  useEffect(() => {
    if (!user) {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return;
    }
    refreshTimerRef.current = setInterval(() => {
      void syncSession(false);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [user, syncSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await cognito.signIn(email, password);
      await syncSession(false);
    },
    [syncSession],
  );

  const signOut = useCallback(async () => {
    try {
      await cognito.globalSignOut();
    } catch {
      await cognito.signOut();
    }
    setUser(null);
    setIdToken(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      isConfigured: cognitoConfig.isConfigured,
      getIdToken: () => idToken,
      signUp: async (email, firstName, lastName, password) => {
        await cognito.signUp(email, firstName, lastName, password);
      },
      confirmSignUp: cognito.confirmSignUp,
      resendCode: cognito.resendConfirmationCode,
      signIn,
      signOut,
      forgotPassword: cognito.forgotPassword,
      confirmPassword: cognito.confirmPassword,
    }),
    [user, isLoading, idToken, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
