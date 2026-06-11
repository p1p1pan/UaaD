import { isAxiosError } from 'axios';

interface BackendErrorPayload {
  code?: number;
  message?: string;
}

interface ResolveApiErrorMessageOptions {
  fallback: string;
  networkFallback?: string;
  badRequestFallback?: string;
  unauthorizedFallback?: string;
  forbiddenFallback?: string;
  notFoundFallback?: string;
  conflictFallback?: string;
}

export function resolveApiErrorMessage(
  error: unknown,
  {
    fallback,
    networkFallback,
    badRequestFallback,
    unauthorizedFallback,
    forbiddenFallback,
    notFoundFallback,
    conflictFallback,
  }: ResolveApiErrorMessageOptions,
) {
  if (!isAxiosError<BackendErrorPayload>(error)) {
    return fallback;
  }

  if (!error.response) {
    return networkFallback ?? fallback;
  }

  const { status, data } = error.response;
  const backendMessage =
    typeof data?.message === 'string' && data.message.trim() ? data.message.trim() : '';

  if (backendMessage) {
    return backendMessage;
  }

  if (status === 400) {
    return badRequestFallback ?? fallback;
  }

  if (status === 401) {
    return unauthorizedFallback ?? fallback;
  }

  if (status === 403) {
    return forbiddenFallback ?? fallback;
  }

  if (status === 404) {
    return notFoundFallback ?? fallback;
  }

  if (status === 409) {
    return conflictFallback ?? fallback;
  }

  return fallback;
}
