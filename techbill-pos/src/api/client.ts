import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { getRootDomain, isMainDomain } from '../lib/domain';

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://electrotrack-saas.onrender.com',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(err: unknown, token: string | null) {
  for (const p of failedQueue) {
    if (err) p.reject(err);
    else if (token) p.resolve(token);
  }
  failedQueue = [];
}

api.interceptors.response.use(
  (r) => r,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const original = error.config as (typeof error.config) & { _retry?: boolean };
    const url = original?.url ?? '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');
    if (error.response?.status === 401 && !original?._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (original) original.headers = original.headers ?? {};
          if (original) original.headers['Authorization'] = `Bearer ${token}`;
          return api(original!);
        });
      }

      if (original) original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await api.post<{ access_token: string; refresh_token?: string }>(
          '/auth/refresh',
          { refresh_token: refreshToken }
        );
        const newToken = data.access_token;
        const newRefreshToken = data.refresh_token || refreshToken;
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          useAuthStore.getState().setAuth(currentUser, newToken, newRefreshToken);
        }
        processQueue(null, newToken);
        if (original) {
          original.headers = original.headers ?? {};
          original.headers['Authorization'] = `Bearer ${newToken}`;
        }
        return api(original!);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        useAuthStore.getState().clearAuth();
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
        
        // Use the logout circuit-breaker for clean state destruction
        if (!isMainDomain(hostname)) {
          const root = getRootDomain(hostname);
          const protocol = isLocalhost ? 'http:' : 'https:';
          window.location.href = `${protocol}//${root}/login?logout=true`;
        } else {
          // Even on main domain, use the circuit-breaker to ensure clean state
          window.location.href = `${window.location.protocol}//${window.location.host}/login?logout=true`;
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
