import axios from "axios";
import { readStoredValue, removeStoredValue, storageKeys } from "../utils/storageKeys";

const productionApiUrl = "https://betterway-api.vercel.app/api";
const localApiUrl = "http://localhost:5050/api";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? productionApiUrl : localApiUrl)
});

api.interceptors.request.use((config) => {
  const token = readStoredValue(storageKeys.authToken, storageKeys.legacyAuthToken);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadToken = Boolean(readStoredValue(storageKeys.authToken, storageKeys.legacyAuthToken));
    const isAuthAttempt = /\/auth\/(login|register|verify-email|forgot-password|reset-password)/.test(error?.config?.url || "");
    if (hadToken && error?.response?.status === 401 && !isAuthAttempt) {
      removeStoredValue(storageKeys.authToken, storageKeys.legacyAuthToken);
      window.dispatchEvent(new Event("betterway:session-expired"));
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || "Algo saiu do trilho.";
}
