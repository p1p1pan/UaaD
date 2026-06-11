import axios from 'axios';
import { AUTH_LOGOUT_EVENT } from '../constants/authEvents';
import {
  buildLoginPath,
  clearStoredAuthSession,
  getStoredAuthSession,
} from '../utils/auth';

interface BackendEnvelope {
  code?: number;
  message?: string;
  data?: unknown;
}

export interface ApiBusinessError extends Error {
  code: number;
  data?: unknown;
  isBusinessError: true;
  response: {
    status: number;
    data: BackendEnvelope;
  };
}

const AUTH_REDIRECT_BYPASS_HEADER = 'X-UAAD-Skip-Auth-Redirect';

function createBusinessError(status: number, payload: BackendEnvelope): ApiBusinessError {
  const error = new Error(payload.message || '业务请求失败') as ApiBusinessError;
  error.code = payload.code || -1;
  error.data = payload.data;
  error.isBusinessError = true;
  error.response = {
    status,
    data: payload,
  };
  return error;
}

function shouldSkipAuthRedirect(headers?: unknown) {
  if (!headers) {
    return false;
  }

  if (typeof headers === 'object' && headers !== null && 'get' in headers) {
    const headerValue = (headers as { get?: (name: string) => string | undefined }).get?.(
      AUTH_REDIRECT_BYPASS_HEADER,
    );
    return headerValue === '1';
  }

  if (typeof headers === 'object' && headers !== null) {
    const record = headers as Record<string, string | undefined>;
    return record[AUTH_REDIRECT_BYPASS_HEADER] === '1';
  }

  return false;
}

const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
  (config) => {
    const token = getStoredAuthSession()?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a global response interceptor for unified error handling
api.interceptors.response.use(
  (response) => {
    const payload = response.data as BackendEnvelope;
    if (response.status === 200 && payload?.code === 1101) {
      return Promise.reject(createBusinessError(response.status, payload));
    }
    return response;
  },
  (error) => {
    if (error.response) {
      const skipAuthRedirect = shouldSkipAuthRedirect(error.config?.headers);

      // Handle 401 Unauthorized
      if (error.response.status === 401) {
        // First dispatch logout event for in-app state sync
        localStorage.removeItem('token');
        clearStoredAuthSession();
        window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));

        // Then redirect to login page (unless bypass header is set)
        if (!skipAuthRedirect && window.location.pathname !== '/login') {
          const redirectTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          window.location.replace(
            buildLoginPath({ redirectTo, reason: 'session_expired' })
          );
        }
      }
      
      // Could also add more global catches for 403, 500, etc. here
      console.error('API Error Response:', error.response.status, error.response.data);
    } else {
      console.error('Network Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;
export { AUTH_REDIRECT_BYPASS_HEADER };
