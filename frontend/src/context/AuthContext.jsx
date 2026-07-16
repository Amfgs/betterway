import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { readStoredValue, removeStoredValue, storageKeys } from "../utils/storageKeys";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = readStoredValue(storageKeys.authToken, storageKeys.legacyAuthToken);
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((response) => setUser(response.data.user))
      .catch(() => removeStoredValue(storageKeys.authToken, storageKeys.legacyAuthToken))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const expireSession = () => {
      removeStoredValue(storageKeys.authToken, storageKeys.legacyAuthToken);
      setUser(null);
    };
    window.addEventListener("betterway:session-expired", expireSession);
    return () => window.removeEventListener("betterway:session-expired", expireSession);
  }, []);

  async function login(credentials) {
    const response = await api.post("/auth/login", credentials);
    localStorage.setItem(storageKeys.authToken, response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }

  async function register(payload) {
    const response = await api.post("/auth/register", payload);
    return response.data;
  }

  async function verifyEmail(payload) {
    const response = await api.post("/auth/verify-email", payload);
    localStorage.setItem(storageKeys.authToken, response.data.token);
    setUser(response.data.user);
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
    removeStoredValue(storageKeys.authToken, storageKeys.legacyAuthToken);
    setUser(null);
  }

  async function updateProfile(fields) {
    const response = await api.put("/auth/me", fields);
    if (response.data.requiresEmailVerification) {
      removeStoredValue(storageKeys.authToken, storageKeys.legacyAuthToken);
      setUser(null);
      return response.data;
    }
    if (response.data.token) localStorage.setItem(storageKeys.authToken, response.data.token);
    setUser(response.data.user);
    return response.data;
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword,
      logout,
      updateProfile
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return context;
}
