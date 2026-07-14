import axios from "axios";
import { readStoredValue, storageKeys } from "../utils/storageKeys";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5050/api"
});

api.interceptors.request.use((config) => {
  const token = readStoredValue(storageKeys.authToken, storageKeys.legacyAuthToken);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || "Algo saiu do trilho.";
}
