import { useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserPreferences } from '../types';

const USER_PREFERENCES_EVENT = 'uaad:user-preferences-changed';
const USER_PREFERENCES_STORAGE_PREFIX = 'uaad.user-preferences';
const preferenceSnapshotCache = new Map<
  string,
  { raw: string | null; value: UserPreferences }
>();

const DEFAULT_PREFERENCES: UserPreferences = {
  avatarDataUrl: '',
  email: '',
  emailNotifications: true,
  smsNotifications: false,
};

function createStorageKey(userId: number | null | undefined) {
  return `${USER_PREFERENCES_STORAGE_PREFIX}.${userId ?? 'guest'}`;
}

function readUserPreferences(storageKey: string): UserPreferences {
  const serialized = localStorage.getItem(storageKey);
  const cachedSnapshot = preferenceSnapshotCache.get(storageKey);

  if (cachedSnapshot && cachedSnapshot.raw === serialized) {
    return cachedSnapshot.value;
  }

  if (!serialized) {
    preferenceSnapshotCache.set(storageKey, {
      raw: null,
      value: DEFAULT_PREFERENCES,
    });
    return DEFAULT_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<UserPreferences>;

    const nextPreferences = {
      avatarDataUrl:
        typeof parsed.avatarDataUrl === 'string' ? parsed.avatarDataUrl : DEFAULT_PREFERENCES.avatarDataUrl,
      email: typeof parsed.email === 'string' ? parsed.email : DEFAULT_PREFERENCES.email,
      emailNotifications:
        typeof parsed.emailNotifications === 'boolean'
          ? parsed.emailNotifications
          : DEFAULT_PREFERENCES.emailNotifications,
      smsNotifications:
        typeof parsed.smsNotifications === 'boolean'
          ? parsed.smsNotifications
          : DEFAULT_PREFERENCES.smsNotifications,
    };

    preferenceSnapshotCache.set(storageKey, {
      raw: serialized,
      value: nextPreferences,
    });

    return nextPreferences;
  } catch {
    localStorage.removeItem(storageKey);
    preferenceSnapshotCache.delete(storageKey);
    return DEFAULT_PREFERENCES;
  }
}

function broadcastPreferencesChange(storageKey: string) {
  window.dispatchEvent(
    new CustomEvent<{ storageKey: string }>(USER_PREFERENCES_EVENT, {
      detail: { storageKey },
    }),
  );
}

function subscribeToPreferences(storageKey: string, callback: () => void) {
  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ storageKey?: string }>).detail;

    if (!detail?.storageKey || detail.storageKey === storageKey) {
      callback();
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === storageKey) {
      callback();
    }
  };

  window.addEventListener(USER_PREFERENCES_EVENT, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(USER_PREFERENCES_EVENT, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

export function useUserPreferences() {
  const { session } = useAuth();
  const storageKey = useMemo(() => createStorageKey(session?.userId), [session?.userId]);

  const preferences = useSyncExternalStore(
    (callback) => subscribeToPreferences(storageKey, callback),
    () => readUserPreferences(storageKey),
    () => DEFAULT_PREFERENCES,
  );

  const updatePreferences = (patch: Partial<UserPreferences>) => {
    const nextPreferences = {
      ...preferences,
      ...patch,
    };

    const serialized = JSON.stringify(nextPreferences);
    localStorage.setItem(storageKey, serialized);
    preferenceSnapshotCache.set(storageKey, {
      raw: serialized,
      value: nextPreferences,
    });
    broadcastPreferencesChange(storageKey);
    return nextPreferences;
  };

  const resetPreferences = () => {
    localStorage.removeItem(storageKey);
    preferenceSnapshotCache.set(storageKey, {
      raw: null,
      value: DEFAULT_PREFERENCES,
    });
    broadcastPreferencesChange(storageKey);
  };

  return {
    preferences,
    updatePreferences,
    resetPreferences,
  };
}
