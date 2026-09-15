import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import {
  clearAuthSession,
  readAuthSession,
  readOrCreateDeviceId,
  storageKeys,
  storeAuthSession
} from "../utils/storageKeys";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState("");
  const restoreOperationRef = useRef(null);
  const lastSessionCheckAtRef = useRef(0);

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

    let operation = restoreOperationRef.current;
    if (!operation || operation.token !== storedSession.token) {
      const capturedToken = storedSession.token;
      operation = {
        token: capturedToken,
        promise: (async () => {
          try {
            const response = await api.get("/auth/me", {
              headers: { Authorization: `Bearer ${capturedToken}` },
              _bwAuthToken: capturedToken,
              _bwPreserveAuthToken: true
            });
            if (readAuthSession()?.token !== capturedToken) return false;
            setUser(response.data.user);
            lastSessionCheckAtRef.current = Date.now();
            return true;
          } catch (error) {
            const status = Number(error?.response?.status || 0);
            const code = error?.response?.data?.code || "";
            const invalidSession = status === 401 || (status === 403 && code === "EMAIL_NOT_VERIFIED");
            if (invalidSession) {
              const cleared = clearAuthSession({ expectedToken: capturedToken });
              if (cleared) {
                setUser(null);
                setSession(null);
              }
            } else if (readAuthSession()?.token === capturedToken) {
              setRestoreError("Sua sessão continua salva, mas não conseguimos confirmá-la agora.");
            }
            return false;
          }
        })()
      };
      restoreOperationRef.current = operation;
    }

    const activeRestore = operation;
    try {
      return await activeRestore.promise;
    } finally {
      if (restoreOperationRef.current === activeRestore) restoreOperationRef.current = null;
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
    window.addEventListener("pageshow", reconnect);
    return () => {
      window.removeEventListener("online", reconnect);
      window.removeEventListener("pageshow", reconnect);
    };
  }, [restoreSession]);

  useEffect(() => {
    if (!user || !session?.token) return undefined;
    const confirmSession = () => {
      const now = Date.now();
      if (document.visibilityState !== "visible" || now - lastSessionCheckAtRef.current < 30_000) return;
      lastSessionCheckAtRef.current = now;
      restoreSession({ showLoading: false });
    };
    const timer = window.setInterval(confirmSession, 30000);
    document.addEventListener("visibilitychange", confirmSession);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", confirmSession);
    };
  }, [restoreSession, session?.token, user?.id]);

  useEffect(() => {
    const expireSession = (event) => {
      const expectedToken = event?.detail?.token;
      const cleared = clearAuthSession({ expectedToken });
      if (!cleared) return;
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
      window.dispatchEvent(new CustomEvent("betterway:session-expired", {
        detail: { token: session.token, code: "TOKEN_EXPIRED" }
      }));
      return undefined;
    }
    const timer = window.setTimeout(
      () => window.dispatchEvent(new CustomEvent("betterway:session-expired", {
        detail: { token: session.token, code: "TOKEN_EXPIRED" }
      })),
      Math.min(remaining, 2_147_000_000)
    );
    return () => window.clearTimeout(timer);
  }, [session?.expiresAt, session?.token]);

  useEffect(() => {
    const syncPersistentSession = (event) => {
      if (![storageKeys.authToken, storageKeys.authSessionStartedAt].includes(event.key)) return;
      const storedSession = readAuthSession();
      if (!storedSession) {
        setUser(null);
        setSession(null);
        return;
      }
      setSession(storedSession);
      restoreSession({ showLoading: false });
    };
    window.addEventListener("storage", syncPersistentSession);
    return () => window.removeEventListener("storage", syncPersistentSession);
  }, [restoreSession]);

  async function login(credentials, { persistent = true } = {}) {
    const response = await api.post("/auth/login", { ...credentials, deviceId: readOrCreateDeviceId() });
    const nextSession = storeAuthSession(response.data.token, { persistent });
    setSession(nextSession);
    setUser(response.data.user);
    lastSessionCheckAtRef.current = Date.now();
    setRestoreError("");
    return response.data.user;
  }

  async function loginWithGoogle(credential, { persistent = true } = {}) {
    const response = await api.post("/auth/google", { credential, deviceId: readOrCreateDeviceId() });
    const nextSession = storeAuthSession(response.data.token, { persistent });
    setSession(nextSession);
    setUser(response.data.user);
    lastSessionCheckAtRef.current = Date.now();
    setRestoreError("");
    return response.data.user;
  }

  async function register(payload) {
    const response = await api.post("/auth/register", payload);
    return response.data;
  }

  async function completeAccountSetup(payload) {
    const response = await api.post("/auth/complete-account", payload);
    const current = readAuthSession();
    const nextSession = storeAuthSession(response.data.token, {
      persistent: current?.persistent ?? true,
      startedAt: current?.startedAt
    });
    setSession(nextSession);
    setUser(response.data.user);
    lastSessionCheckAtRef.current = Date.now();
    setRestoreError("");
    return response.data;
  }

  async function checkUsernameAvailability(username) {
    const response = await api.get("/auth/username-availability", { params: { username } });
    return response.data;
  }

  async function verifyEmail(payload, { persistent = true } = {}) {
    const response = await api.post("/auth/verify-email", { ...payload, deviceId: readOrCreateDeviceId() });
    const nextSession = storeAuthSession(response.data.token, { persistent });
    setSession(nextSession);
    setUser(response.data.user);
    lastSessionCheckAtRef.current = Date.now();
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

  async function verifyResetCode(payload) {
    const response = await api.post("/auth/verify-reset-code", payload);
    return response.data;
  }

  async function resetPassword(payload) {
    const response = await api.post("/auth/reset-password", payload);
    return response.data;
  }

  function logout({ redirectTo = "/" } = {}) {
    clearAuthSession();
    setUser(null);
    setSession(null);
    setRestoreError("");
    if (redirectTo && window.location.pathname !== redirectTo) window.location.replace(redirectTo);
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
      lastSessionCheckAtRef.current = Date.now();
      setRestoreError("");
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
      completeAccountSetup,
      checkUsernameAvailability,
      verifyEmail,
      resendVerification,
      forgotPassword,
      verifyResetCode,
      resetPassword,
      logout,
      retrySession: restoreSession,
      refreshUser: () => restoreSession({ showLoading: false }),
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
