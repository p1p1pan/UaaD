import type { AxiosError } from 'axios';
import type { ApiBusinessError } from '../api/axios';

export function getRequestErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'isBusinessError' in error &&
    (error as ApiBusinessError).isBusinessError === true
  ) {
    return (error as ApiBusinessError).message;
  }

  const ax = error as AxiosError<{ message?: string }>;
  const msg = ax.response?.data?.message;
  if (typeof msg === 'string' && msg.trim()) {
    return msg;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '请求失败，请稍后重试';
}
