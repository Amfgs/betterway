import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { apiRequest, apiUrlStorageKey, legacyApiUrlStorageKey, setApiUrlOverride } from "../api/client";

const AuthContext = createContext(null);
const tokenStorageKey = "betterway_mobile_token";
const legacyTokenStorageKey = "valorize_mobile_token";
const sessionStartedAtKey = "betterway_mobile_session_started_at";
const biometricEnabledKey = "betterway_mobile_biometric_enabled";
const lastEmailKey = "betterway_mobile_last_email";
const SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000;

function biometricName(types = []) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "Face ID ou biometria facial";
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "Touch ID ou impressão digital";
  return "Biometria do aparelho";
}

async function biometricCapability() {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync()
  ]);
  return {
    available: hasHardware && isEnrolled,
    hasHardware,
    isEnrolled,
    label: biometricName(types),
    types
  };
}

async function promptForBiometrics() {
  return LocalAuthentication.authenticateAsync({
    promptMessage: "Abrir a Better Way",
    promptSubtitle: "Confirme sua identidade para acessar seus dados financeiros.",
    promptDescription: "Use a biometria ou o bloqueio do aparelho.",
    cancelLabel: "Cancelar",
    fallbackLabel: "Usar código do aparelho",
    disableDeviceFallback: false,
    biometricsSecurityLevel: "strong"
  });
}

async function removeStoredSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(tokenStorageKey),
    SecureStore.deleteItemAsync(legacyTokenStorageKey),
    SecureStore.deleteItemAsync(sessionStartedAtKey)
  ]);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [locked, setLocked] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [lastEmail, setLastEmail] = useState("");
  const [session, setSession] = useState(null);
  const [biometric, setBiometric] = useState({
    available: false,
    enabled: false,
    hasHardware: false,
    isEnrolled: false,
    label: "Biometria do aparelho"
  });
  const pendingToken = useRef(null);

  async function activateSession(storedToken, storedStart, persistent = true) {
    const data = await apiRequest("/auth/me", { token: storedToken });
    const startedAt = Number(storedStart) || Date.now();
    pendingToken.current = null;
    setToken(storedToken);
    setUser(data.user);
    setSession({ persistent, startedAt, expiresAt: startedAt + SESSION_TTL_MS });
    setLocked(false);
    setUnlockError("");
    return data.user;
  }

  async function unlockWithBiometrics() {
    const storedToken = pendingToken.current || await SecureStore.getItemAsync(tokenStorageKey);
    if (!storedToken) {
      setLocked(false);
      return false;
    }
    setUnlockError("");
    const capability = await biometricCapability();
    setBiometric((current) => ({ ...current, ...capability }));
    if (!capability.available) {
      setUnlockError(
        capability.hasHardware
          ? "Cadastre uma biometria nas configurações do aparelho ou entre com sua senha."
          : "Este aparelho não oferece biometria. Entre com sua senha para continuar."
      );
      setLocked(true);
      return false;
    }

    const result = await promptForBiometrics();
    if (!result.success) {
      setUnlockError(result.error === "user_cancel" ? "Desbloqueio cancelado." : "Não foi possível confirmar sua identidade.");
      setLocked(true);
      return false;
    }

    try {
      const storedStart = await SecureStore.getItemAsync(sessionStartedAtKey);
      await activateSession(storedToken, storedStart, true);
      return true;
    } catch (error) {
      if ([401, 403].includes(error.status)) await removeStoredSession();
      setUnlockError(error.message || "Não foi possível restaurar sua sessão.");
      setRestoreError(error.message || "Não foi possível restaurar sua sessão.");
      setLocked(false);
      return false;
    }
  }

  async function usePasswordInstead() {
    pendingToken.current = null;
    await removeStoredSession();
    setToken(null);
    setUser(null);
    setSession(null);
    setLocked(false);
    setUnlockError("");
  }

  useEffect(() => {
    let alive = true;

    async function restoreSession() {
      try {
        const currentApiUrl = await SecureStore.getItemAsync(apiUrlStorageKey);
        const legacyApiUrl = currentApiUrl ? null : await SecureStore.getItemAsync(legacyApiUrlStorageKey);
        const storedApiUrl = currentApiUrl || legacyApiUrl;
        if (legacyApiUrl) await SecureStore.setItemAsync(apiUrlStorageKey, legacyApiUrl);
        if (storedApiUrl && !setApiUrlOverride(storedApiUrl)) {
          await Promise.all([
            SecureStore.deleteItemAsync(apiUrlStorageKey),
            SecureStore.deleteItemAsync(legacyApiUrlStorageKey)
          ]);
        }

        const [currentToken, legacyToken, storedStart, enabledValue, storedEmail, capability] = await Promise.all([
          SecureStore.getItemAsync(tokenStorageKey),
          SecureStore.getItemAsync(legacyTokenStorageKey),
          SecureStore.getItemAsync(sessionStartedAtKey),
          SecureStore.getItemAsync(biometricEnabledKey),
          SecureStore.getItemAsync(lastEmailKey),
          biometricCapability()
        ]);
        if (!alive) return;
        const storedToken = currentToken || legacyToken;
        const biometricEnabled = enabledValue === "true";
        setLastEmail(storedEmail || "");
        setBiometric({ ...capability, enabled: biometricEnabled });
        if (legacyToken && !currentToken) await SecureStore.setItemAsync(tokenStorageKey, legacyToken);
        if (!storedToken) return;

        const startedAt = Number(storedStart) || Date.now();
        if (!storedStart) await SecureStore.setItemAsync(sessionStartedAtKey, String(startedAt));
        if (startedAt + SESSION_TTL_MS <= Date.now()) {
          await removeStoredSession();
          setRestoreError("Sua sessão de 15 dias terminou. Entre novamente para proteger seus dados.");
          return;
        }

        pendingToken.current = storedToken;
        if (biometricEnabled) {
          setLocked(true);
          const result = capability.available ? await promptForBiometrics() : { success: false, error: "not_available" };
          if (!alive) return;
          if (!result.success) {
            setUnlockError(
              capability.available
                ? "Confirme sua identidade para abrir a Better Way."
                : "A biometria não está disponível. Entre com sua senha para continuar."
            );
            return;
          }
        }

        await activateSession(storedToken, startedAt, true);
      } catch (error) {
        if ([401, 403].includes(error.status)) await removeStoredSession();
        if (alive) setRestoreError(error.message || "Não foi possível restaurar sua sessão.");
      } finally {
        if (alive) setBooting(false);
      }
    }

    restoreSession();
    return () => {
      alive = false;
    };
  }, []);

  async function persistSession(nextToken, startedAt, persistent) {
    if (!persistent) {
      await removeStoredSession();
      return;
    }
    await Promise.all([
      SecureStore.setItemAsync(tokenStorageKey, nextToken),
      SecureStore.setItemAsync(sessionStartedAtKey, String(startedAt))
    ]);
  }

  async function login(credentials, { persistent = true } = {}) {
    const data = await apiRequest("/auth/login", { method: "POST", body: credentials });
    const startedAt = Date.now();
    await persistSession(data.token, startedAt, persistent);
    await SecureStore.setItemAsync(lastEmailKey, credentials.email.trim().toLowerCase());
    setLastEmail(credentials.email.trim().toLowerCase());
    setToken(data.token);
    setUser(data.user);
    setSession({ persistent, startedAt, expiresAt: startedAt + SESSION_TTL_MS });
    setRestoreError("");
    return data.user;
  }

  async function register(payload) {
    return apiRequest("/auth/register", { method: "POST", body: payload });
  }

  async function checkUsernameAvailability(username) {
    return apiRequest(`/auth/username-availability?username=${encodeURIComponent(username)}`);
  }

  async function verifyEmail(payload, { persistent = true } = {}) {
    const data = await apiRequest("/auth/verify-email", { method: "POST", body: payload });
    const startedAt = Date.now();
    await persistSession(data.token, startedAt, persistent);
    await SecureStore.setItemAsync(lastEmailKey, payload.email.trim().toLowerCase());
    setLastEmail(payload.email.trim().toLowerCase());
    setToken(data.token);
    setUser(data.user);
    setSession({ persistent, startedAt, expiresAt: startedAt + SESSION_TTL_MS });
    return data;
  }

  async function resendVerification(payload) {
    return apiRequest("/auth/resend-verification", { method: "POST", body: payload });
  }

  async function forgotPassword(payload) {
    return apiRequest("/auth/forgot-password", { method: "POST", body: payload });
  }

  async function resetPassword(payload) {
    return apiRequest("/auth/reset-password", { method: "POST", body: payload });
  }

  async function setSessionPersistence(persistent) {
    if (!token || !session) return;
    await persistSession(token, session.startedAt, persistent);
    setSession((current) => ({ ...current, persistent }));
  }

  async function setBiometricEnabled(enabled) {
    if (!enabled) {
      await SecureStore.deleteItemAsync(biometricEnabledKey);
      setBiometric((current) => ({ ...current, enabled: false }));
      return { enabled: false };
    }

    const capability = await biometricCapability();
    setBiometric((current) => ({ ...current, ...capability }));
    if (!capability.available) {
      throw new Error(
        capability.hasHardware
          ? "Cadastre uma biometria nas configurações do aparelho antes de ativar este acesso."
          : "Este aparelho não possui biometria compatível."
      );
    }
    const result = await promptForBiometrics();
    if (!result.success) throw new Error("A biometria não foi confirmada.");
    if (!session?.persistent) await setSessionPersistence(true);
    await SecureStore.setItemAsync(biometricEnabledKey, "true");
    setBiometric((current) => ({ ...current, ...capability, enabled: true }));
    return { enabled: true, label: capability.label };
  }

  async function updateProfile(fields) {
    const data = await apiRequest("/auth/me", { method: "PUT", token, body: fields });
    if (data.requiresEmailVerification) {
      await removeStoredSession();
      setToken(null);
      setUser(null);
      setSession(null);
      return data;
    }
    if (data.token) {
      const startedAt = session?.startedAt || Date.now();
      await persistSession(data.token, startedAt, session?.persistent ?? true);
      setToken(data.token);
    }
    setUser(data.user);
    return data;
  }

  async function logout() {
    pendingToken.current = null;
    await removeStoredSession();
    setToken(null);
    setUser(null);
    setSession(null);
    setLocked(false);
  }

  const value = useMemo(
    () => ({
      biometric,
      booting,
      checkUsernameAvailability,
      forgotPassword,
      lastEmail,
      locked,
      login,
      logout,
      register,
      resendVerification,
      resetPassword,
      restoreError,
      session,
      setBiometricEnabled,
      setSessionPersistence,
      token,
      unlockError,
      unlockWithBiometrics,
      updateProfile,
      usePasswordInstead,
      user,
      verifyEmail
    }),
    [biometric, booting, lastEmail, locked, restoreError, session, token, unlockError, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return context;
}
