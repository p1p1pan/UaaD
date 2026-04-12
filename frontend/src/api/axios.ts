import axios from 'axios';
import { AUTH_LOGOUT_EVENT } from '../constants/authEvents';

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

const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
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
      // Handle 401 Unauthorized
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
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
