import axios, { AxiosError } from 'axios';

export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const SOCKET_ORIGIN = (import.meta.env.VITE_SOCKET_URL || API_ORIGIN || window.location.origin).replace(/\/$/, '');

export const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  timeout: 45_000,
});

api.interceptors.request.use((config) => {
  const raw = sessionStorage.getItem('goliat-auth');
  if (raw) {
    try {
      const token = JSON.parse(raw)?.state?.token;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      sessionStorage.removeItem('goliat-auth');
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) window.dispatchEvent(new Event('goliat:unauthorized'));
    return Promise.reject(error);
  },
);

export const assetUrl = (relativePath: string) => `${API_ORIGIN}/dataset/${relativePath}`;

export const getErrorMessage = (error: unknown, fallback = 'No fue posible completar la operación') => {
  if (axios.isAxiosError<{ error?: string } | string>(error)) {
    const data = error.response?.data;
    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data === 'object' && 'error' in data && data.error) return data.error;
    return error.code === 'ECONNABORTED' ? 'La solicitud tardó demasiado' : fallback;
  }
  return error instanceof Error ? error.message : fallback;
};
