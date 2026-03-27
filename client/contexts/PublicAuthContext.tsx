import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface PublicUser {
  id: number;
  username: string;
  unique_id: string;
  is_banned?: boolean;
  is_admin?: boolean;
  created_at: string;
  rp_phone?: string | null;
  rp_firstname?: string | null;
  rp_lastname?: string | null;
  avatar_url?: string | null;
}

interface PublicAuthContextType {
  user: PublicUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, uniqueId: string, referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const PublicAuthContext = createContext<PublicAuthContextType | null>(null);

function decodeTokenPayload(t: string): Partial<PublicUser> | null {
  try {
    const payload = JSON.parse(atob(t.split(".")[1]));
    if (!payload.userId || !payload.username) return null;
    return { id: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

export function PublicAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("public_token"));
  const [user, setUser] = useState<PublicUser | null>(() => {
    const t = localStorage.getItem("public_token");
    if (!t) return null;
    return decodeTokenPayload(t) as PublicUser | null;
  });
  const [loading, setLoading] = useState(true);

  const checkSession = async (storedToken: string, isInitial = false) => {
    try {
      const r = await fetch("/api/public/me", {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (r.status === 401 || r.status === 403) {
        localStorage.removeItem("public_token");
        setToken(null);
        setUser(null);
        return;
      }
      if (!r.ok) return;
      const data = await r.json();
      setUser((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(data.user)) return prev;
        return data.user;
      });
      setToken(storedToken);
    } catch {
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("public_token");
    if (!storedToken) {
      setLoading(false);
      return;
    }
    checkSession(storedToken, true);

    const interval = setInterval(() => {
      const currentToken = localStorage.getItem("public_token");
      if (currentToken) checkSession(currentToken);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/public/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      const baseMsg = data.error || "Erreur de connexion";
      const reason = data.ban_reason ? `\nRaison : ${data.ban_reason}` : "";
      const err: any = new Error(baseMsg + reason);
      err.ban_reason = data.ban_reason || null;
      err.isBanned = res.status === 403;
      throw err;
    }
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("public_token", data.token);
  };

  const register = async (username: string, password: string, uniqueId: string, referralCode?: string) => {
    const res = await fetch("/api/public/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, uniqueId, ...(referralCode ? { referralCode } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur lors de l'inscription");
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("public_token", data.token);
  };

  const logout = async () => {
    await fetch("/api/public/logout", { method: "POST" });
    setUser(null);
    setToken(null);
    localStorage.removeItem("public_token");
  };

  const refreshUser = async () => {
    const storedToken = localStorage.getItem("public_token");
    if (storedToken) await checkSession(storedToken);
  };

  return (
    <PublicAuthContext.Provider value={{ user, token, login, register, logout, refreshUser, loading }}>
      {children}
    </PublicAuthContext.Provider>
  );
}

export function usePublicAuth() {
  const ctx = useContext(PublicAuthContext);
  if (!ctx) throw new Error("usePublicAuth must be used within PublicAuthProvider");
  return ctx;
}
