
/* eslint-disable react-refresh/only-export-components */import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, setToken } from "./api";

interface Admin {
  id: string;
  username: string;
}

interface AuthContextValue {
  admin: Admin | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  // Start "loading" only if a token exists. No token = not loading.
  const [loading, setLoading] = useState<boolean>(() => Boolean(getToken()));

  useEffect(() => {
    const token = getToken();
    if (!token) return; // already not loading via initial state

    let cancelled = false;

    api<{ users: unknown[] }>("/users")
      .then(() => {
        if (!cancelled) setAdmin({ id: "self", username: "admin" });
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setAdmin(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(username: string, password: string): Promise<void> {
    const res = await api<{ token: string; admin: Admin }>("/auth/login", {
      method: "POST",
      body: { username, password },
      auth: false,
    });
    setToken(res.token);
    setAdmin(res.admin);
  }

  function logout(): void {
    setToken(null);
    setAdmin(null);
  }

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}