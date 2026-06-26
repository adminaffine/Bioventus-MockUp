import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AUTH_SESSION_STORAGE_KEY,
  USER_PERSONA_STORAGE_KEY,
  type AccountType,
  formatAccessExpiryDate,
  isUserAccessExpired,
  landingRouteForAccount,
  validateCredentials,
} from "../config/auth";

export type AuthSession = {
  accountType: AccountType;
  loggedInAt: string;
};

type LoginResult =
  | { ok: true; accountType: AccountType }
  | { ok: false; error: string };

type AuthContextValue = {
  session: AuthSession | null;
  accountType: AccountType | null;
  isAuthenticated: boolean;
  userAccessExpired: boolean;
  login: (username: string, password: string) => LoginResult;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    try {
      sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
  }, []);

  const login = useCallback((username: string, password: string): LoginResult => {
    const accountType = validateCredentials(username, password);
    if (!accountType) {
      return { ok: false, error: "Invalid username or password." };
    }
    if (accountType === "user" && isUserAccessExpired()) {
      return {
        ok: false,
        error: `User access expired on ${formatAccessExpiryDate()}. Contact your administrator.`,
      };
    }
    if (accountType === "user") {
      try {
        sessionStorage.removeItem(USER_PERSONA_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    const next: AuthSession = {
      accountType,
      loggedInAt: new Date().toISOString(),
    };
    setSession(next);
    return { ok: true, accountType };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      accountType: session?.accountType ?? null,
      isAuthenticated: session !== null,
      userAccessExpired: isUserAccessExpired(),
      login,
      logout,
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { landingRouteForAccount };
