/**
 * Axios API client for CCM.
 *
 * Security rules enforced:
 * - withCredentials: true — sends httpOnly session cookie automatically.
 * - X-CSRF-Token header injected from Zustand auth store for all state-mutating
 *   methods (POST, PATCH, PUT, DELETE).
 * - X-Correlation-ID: UUID generated per request for traceability.
 * - On 401: clear auth store and redirect to /login.
 * - No JWT, no sensitive data in localStorage.
 *
 * Source: security-principles.md, task brief API client spec
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/features/auth/authStore';

const MUTATING_METHODS = new Set(['post', 'patch', 'put', 'delete']);

function generateCorrelationId(): string {
  // Use crypto.randomUUID() when available (modern browsers), fallback otherwise
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Simple fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env['VITE_API_BASE_URL'] ?? '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30_000,
});

// ---------------------------------------------------------------------------
// Request interceptor: inject CSRF token + Correlation ID
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Always attach Correlation ID
    config.headers['X-Correlation-ID'] = generateCorrelationId();

    // Inject CSRF token for state-mutating methods
    const method = (config.method ?? '').toLowerCase();
    if (MUTATING_METHODS.has(method)) {
      const csrfToken = useAuthStore.getState().csrfToken;
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor: handle 401 globally
// ---------------------------------------------------------------------------
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear auth state — do NOT attempt to refresh tokens
      useAuthStore.getState().clearAuth();
      // Redirect to login. Use window.location to avoid circular dependency
      // with the router (this module is imported before the router is mounted).
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.replace('/login?reason=session_expired');
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Canonical API response envelope. All CCM backend endpoints return this shape.
 * Import from here rather than defining inline in individual API modules.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export { apiClient };
