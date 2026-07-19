import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { clearAuthSession, readAuthSession, storeAuthSession } from "../utils/storageKeys";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState("");

  const restoreSession = useCallback(async ({ showLoading = true } = {}) => {
    const storedSession = readAuthSession();
    if (!storedSession) {
      setUser(null);
      setSession(null);
      setRestoreError("");
      if (showLoading) setLoading(false);
      return false;
    }

    setSession(storedSession);
    setRestoreError("");
    if (showLoading) setLoading(true);

    try {
      const response = await api.get("/auth/me");
      setUser(response.data.user);
      return true;
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      if (status === 401 || status === 403) {
        clearAuthSession();
        setUser(null);
        setSession(null);
      } else {
        setRestoreError("Sua sessão continua salva, mas não conseguimos confirmá-la agora.");
      }
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const reconnect = () => {
      if (readAuthSession()) restoreSession({ showLoading: false });
    };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [restoreSession]);

  useEffect(() => {
    const expireSession = () => {
      clearAuthSession();
      setUser(null);
      setSession(null);
      setRestoreError("");
    };
    window.addEventListener("betterway:session-expired", expireSession);
    return () => window.removeEventListener("betterway:session-expired", expireSession);
  }, []);

  useEffect(() => {
    if (!session?.expiresAt) return undefined;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      window.dispatchEvent(new Event("betterway:session-expired"));
      return undefined;
    }
    const timer = window.setTimeout(
      () => window.dispatchEvent(new Event("betterway:session-expired")),
      Math.min(remaining, 2_147_000_000)
    );
    return () => window.clearTimeout(timer);
  }, [session?.expiresAt]);

  async function login(credentials, { persistent = true } = {}) {
    const response = await api.post("/auth/login", credentials);
    const nextSession = storeAuthSession(response.data.token, { persistent });
    setSession(nextSession);
    setUser(response.data.user);
    setRestoreError("");
    return response.data.user;
  }

  async function loginWithGoogle(credential, { persistent = true } = {}) {
    const response = await api.post("/auth/google", { credential });
    const nextSession = storeAuthSession(response.data.token, { persistent });
    setSession(nextSession);
    setUser(response.data.user);
    setRestoreError("");
    return response.data.user;
  }

  async function register(payload) {
    const response = await api.post("/auth/register", payload);
    return response.data;
  }

  async function checkUsernameAvailability(username) {
    const response = await api.get("/auth/username-availability", { params: { username } });
    return response.data;
  }

  async function verifyEmail(payload, { persistent = true } = {}) {
    const response = await api.post("/auth/verify-email", payload);
    const nextSession = storeAuthSession(response.data.token, { persistent });
    setSession(nextSession);
    setUser(response.data.user);
    setRestoreError("");
    return response.data;
  }

  async function resendVerification(payload) {
    const response = await api.post("/auth/resend-verification", payload);
    return response.data;
  }

  async function forgotPassword(payload) {
    const response = await api.post("/auth/forgot-password", payload);
    return response.data;
  }

  async function resetPassword(payload) {
    const response = await api.post("/auth/reset-password", payload);
    return response.data;
  }

  function logout() {
    clearAuthSession();
    setUser(null);
    setSession(null);
    setRestoreError("");
  }

  function setSessionPersistence(persistent) {
    const current = readAuthSession();
    if (!current) return;
    const nextSession = storeAuthSession(current.token, {
      persistent,
      startedAt: current.startedAt
    });
    setSession(nextSession);
  }

  async function updateProfile(fields) {
    const response = await api.put("/auth/me", fields);
    if (response.data.requiresEmailVerification) {
      clearAuthSession();
      setUser(null);
      setSession(null);
      return response.data;
    }
    if (response.data.token) {
      const current = readAuthSession();
      setSession(storeAuthSession(response.data.token, {
        persistent: current?.persistent ?? true,
        startedAt: current?.startedAt
      }));
    }
    setUser(response.data.user);
    return response.data;
  }

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      restoreError,
      isAuthenticated: Boolean(user),
      login,
      loginWithGoogle,
      register,
      checkUsernameAvailability,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword,
      logout,
      retrySession: restoreSession,
      setSessionPersistence,
      updateProfile
    }),
    [user, loading, restoreError, restoreSession, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return context;
}
