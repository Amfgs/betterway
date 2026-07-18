import axios from "axios";
import { clearAuthSession, readAuthToken } from "../utils/storageKeys";

const productionApiUrl = "https://betterway-api.vercel.app/api";
const localApiUrl = "http://localhost:5050/api";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? productionApiUrl : localApiUrl)
});

api.interceptors.request.use((config) => {
  const token = readAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadToken = Boolean(readAuthToken());
    const isAuthAttempt = /\/auth\/(login|register|verify-email|forgot-password|reset-password)/.test(error?.config?.url || "");
    if (hadToken && error?.response?.status === 401 && !isAuthAttempt) {
      clearAuthSession();
      window.dispatchEvent(new Event("betterway:session-expired"));
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
