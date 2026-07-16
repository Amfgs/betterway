import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { apiRequest, apiUrlStorageKey, legacyApiUrlStorageKey, setApiUrlOverride } from "../api/client";

const AuthContext = createContext(null);
const tokenStorageKey = "betterway_mobile_token";
const legacyTokenStorageKey = "valorize_mobile_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let alive = true;

    async function restoreSession() {
      try {
        const currentApiUrl = await SecureStore.getItemAsync(apiUrlStorageKey);
        const legacyApiUrl = currentApiUrl ? null : await SecureStore.getItemAsync(legacyApiUrlStorageKey);
        const storedApiUrl = currentApiUrl || legacyApiUrl;
        if (legacyApiUrl) await SecureStore.setItemAsync(apiUrlStorageKey, legacyApiUrl);
        if (storedApiUrl) setApiUrlOverride(storedApiUrl);
        const currentToken = await SecureStore.getItemAsync(tokenStorageKey);
        const legacyToken = currentToken ? null : await SecureStore.getItemAsync(legacyTokenStorageKey);
        const storedToken = currentToken || legacyToken;
        if (legacyToken) await SecureStore.setItemAsync(tokenStorageKey, legacyToken);
        if (!storedToken) return;
        const data = await apiRequest("/auth/me", { token: storedToken });
        if (!alive) return;
        setToken(storedToken);
        setUser(data.user);
      } catch (error) {
        await SecureStore.deleteItemAsync(tokenStorageKey);
        await SecureStore.deleteItemAsync(legacyTokenStorageKey);
      } finally {
        if (alive) setBooting(false);
      }
    }

    restoreSession();
    return () => {
      alive = false;
    };
  }, []);

  async function login(credentials) {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: credentials
    });
    await SecureStore.setItemAsync(tokenStorageKey, data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function register(payload) {
    return apiRequest("/auth/register", {
      method: "POST",
      body: payload
    });
  }

  async function verifyEmail(payload) {
    const data = await apiRequest("/auth/verify-email", {
      method: "POST",
      body: payload
    });
    await SecureStore.setItemAsync(tokenStorageKey, data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function resendVerification(payload) {
    return apiRequest("/auth/resend-verification", {
      method: "POST",
      body: payload
    });
  }

  async function forgotPassword(payload) {
    return apiRequest("/auth/forgot-password", {
      method: "POST",
      body: payload
    });
  }

  async function resetPassword(payload) {
    return apiRequest("/auth/reset-password", {
      method: "POST",
      body: payload
    });
  }

  async function updateProfile(fields) {
    const data = await apiRequest("/auth/me", {
      method: "PUT",
      token,
      body: fields
    });
    if (data.requiresEmailVerification) {
      await SecureStore.deleteItemAsync(tokenStorageKey);
      setToken(null);
      setUser(null);
      return data;
    }
    if (data.token) {
      await SecureStore.setItemAsync(tokenStorageKey, data.token);
      setToken(data.token);
    }
    setUser(data.user);
    return data;
  }

  async function logout() {
    await SecureStore.deleteItemAsync(tokenStorageKey);
    await SecureStore.deleteItemAsync(legacyTokenStorageKey);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      booting,
      token,
      user,
      login,
      register,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword,
      updateProfile,
      logout
    }),
    [booting, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return context;
}
