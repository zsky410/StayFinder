import { createContext, useContext, useMemo, useState } from "react";
import { api, getToken, setToken as persistToken } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());

  const login = async (candidate) => {
    const value = String(candidate || "").trim();
    if (!value) {
      throw new Error("Vui lòng nhập admin token.");
    }
    persistToken(value);
    setTokenState(value);
    try {
      await api.verifyToken();
    } catch (error) {
      persistToken("");
      setTokenState("");
      throw error;
    }
  };

  const logout = () => {
    persistToken("");
    setTokenState("");
  };

  const value = useMemo(
    () => ({ token, isAuthenticated: Boolean(token), login, logout }),
    [token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
