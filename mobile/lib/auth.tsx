import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";

import {
  fetchCurrentUser,
  loginWithEmail,
  logoutSession,
  signupWithEmail,
  type AuthUser,
} from "@/lib/stayfinder";

const AUTH_TOKEN_KEY = "stayfinder.authToken";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: { email: string; password: string; displayName?: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function getStoredAuthToken() {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(AUTH_TOKEN_KEY) ?? null;
  }
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

async function setStoredAuthToken(token: string) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(AUTH_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

async function deleteStoredAuthToken() {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

function normalizeAuthError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Có lỗi xảy ra. Bạn thử lại sau nhé.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      try {
        const storedToken = await getStoredAuthToken();
        if (!storedToken) {
          return;
        }

        const payload = await fetchCurrentUser(storedToken);
        if (!isActive) {
          return;
        }
        setToken(storedToken);
        setUser(payload.user);
      } catch {
        await deleteStoredAuthToken();
        if (isActive) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isActive) {
          setIsInitializing(false);
        }
      }
    }

    restoreSession().catch(() => {
      if (isActive) {
        setIsInitializing(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isInitializing,
      isAuthenticated: Boolean(user && token),
      async signIn(email, password) {
        try {
          const payload = await loginWithEmail({ email, password });
          await setStoredAuthToken(payload.session.token);
          setToken(payload.session.token);
          setUser(payload.user);
        } catch (error) {
          throw new Error(normalizeAuthError(error));
        }
      },
      async signUp(payload) {
        try {
          const response = await signupWithEmail(payload);
          await setStoredAuthToken(response.session.token);
          setToken(response.session.token);
          setUser(response.user);
        } catch (error) {
          throw new Error(normalizeAuthError(error));
        }
      },
      async signOut() {
        const currentToken = token;
        setToken(null);
        setUser(null);
        await deleteStoredAuthToken();
        if (currentToken) {
          await logoutSession(currentToken).catch(() => undefined);
        }
      },
    }),
    [isInitializing, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
