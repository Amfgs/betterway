import axios from "axios";
import { clearAuthSession, readAuthToken } from "../utils/storageKeys";

const productionApiUrl = "https://betterway-api.vercel.app/api";
const localApiUrl = "http://localhost:5050/api";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? productionApiUrl : localApiUrl)
});

let sessionValidationPromise = null;

async function validateStoredSession(token) {
  if (!sessionValidationPromise) {
    sessionValidationPromise = axios.get(`${api.defaults.baseURL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 12000,
      validateStatus: () => true
    }).then((response) => {
      if (response.status === 200) return "valid";
      if ([401, 403].includes(response.status)) return "invalid";
      return "unknown";
    }).catch(() => "unknown").finally(() => {
      sessionValidationPromise = null;
    });
  }
  return sessionValidationPromise;
}

api.interceptors.request.use((config) => {
  const token = readAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const hadToken = Boolean(readAuthToken());
    const requestUrl = error?.config?.url || "";
    const isAuthRequest = /\/auth\/(login|register|verify-email|forgot-password|reset-password|me)/.test(requestUrl);
    if (hadToken && error?.response?.status === 401 && !isAuthRequest && !error?.config?._bwSessionConfirmed) {
      const token = readAuthToken();
      const sessionState = token ? await validateStoredSession(token) : "invalid";
      if (sessionState === "valid") {
        return api.request({ ...error.config, _bwSessionConfirmed: true });
      }
      if (sessionState === "invalid") {
        clearAuthSession();
        window.dispatchEvent(new Event("betterway:session-expired"));
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error) {
  if (error?.code === "ERR_NETWORK" || (!error?.response && error?.request)) {
    return "Não foi possível conectar ao serviço da Better Way. Verifique sua conexão e tente novamente.";
  }
  return error?.response?.data?.message || error?.message || "Algo saiu do trilho.";
}
