import Constants from "expo-constants";
import { Platform } from "react-native";

function isLocalhost(host) {
  return ["localhost", "127.0.0.1", "::1"].includes(host);
}

function isTunnelHost(host) {
  return /exp\.direct|ngrok|expo\.dev|trycloudflare|loca\.lt/i.test(host);
}

function getExpoHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost ||
    "";
  return hostUri.split(":")[0];
}

export const apiUrlStorageKey = "betterway_mobile_api_url";
export const legacyApiUrlStorageKey = "valorize_mobile_api_url";
const trustedProductionHosts = new Set(["api.betterway.com.br", "betterway-api.vercel.app"]);

function normalizedApiUrl(value) {
  try {
    const url = new URL(String(value || "").trim().replace(/\/$/, ""));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function isApiUrlAllowed(value) {
  const cleanUrl = normalizedApiUrl(value);
  if (!cleanUrl) return false;
  if (__DEV__) return true;
  const url = new URL(cleanUrl);
  return url.protocol === "https:" && trustedProductionHosts.has(url.hostname) && url.pathname.startsWith("/api");
}

function resolveApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");

  const configuredUrl = Constants.expoConfig?.extra?.apiUrl;
  if (configuredUrl && !configuredUrl.includes("localhost") && !configuredUrl.includes("127.0.0.1")) {
    return configuredUrl.replace(/\/$/, "");
  }

  const expoHost = getExpoHost();
  if (expoHost && !isLocalhost(expoHost) && !isTunnelHost(expoHost)) {
    return `http://${expoHost}:5050/api`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:5050/api";
  }

  return "http://localhost:5050/api";
}

const DEFAULT_API_URL = resolveApiUrl();
let runtimeApiUrl = DEFAULT_API_URL;

export function setApiUrlOverride(value) {
  const nextUrl = normalizedApiUrl(value || DEFAULT_API_URL);
  if (!isApiUrlAllowed(nextUrl)) {
    runtimeApiUrl = DEFAULT_API_URL;
    return false;
  }
  runtimeApiUrl = nextUrl;
  return true;
}

export function getApiUrl() {
  return runtimeApiUrl;
}

export async function apiRequest(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    let message = "Erro ao consultar a API.";
    let code = "";
    try {
      const data = await response.json();
      message = data.message || message;
      code = data.code || "";
    } catch (error) {
      message = response.statusText || message;
    }
    const requestError = new Error(message);
    requestError.code = code;
    requestError.status = response.status;
    throw requestError;
  }

  if (response.status === 204) return null;
  return response.json();
}

export { DEFAULT_API_URL as API_URL };
