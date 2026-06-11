interface StoredActivityReminder {
  activityId: number;
  title: string;
  openAt: string;
  createdAt: string;
}

const REMINDER_STORAGE_PREFIX = 'uaad.activity.reminders';

function createStorageKey(userId: number | undefined) {
  return `${REMINDER_STORAGE_PREFIX}.${userId ?? 'guest'}`;
}

function readStoredReminders(userId: number | undefined): StoredActivityReminder[] {
  if (!userId) {
    return [];
  }

  const serialized = localStorage.getItem(createStorageKey(userId));
  if (!serialized) {
    return [];
  }

  try {
    const parsed = JSON.parse(serialized) as StoredActivityReminder[];
    return parsed.filter(
      (item) =>
        typeof item.activityId === 'number' &&
        typeof item.title === 'string' &&
        typeof item.openAt === 'string' &&
        typeof item.createdAt === 'string',
    );
  } catch {
    localStorage.removeItem(createStorageKey(userId));
    return [];
  }
}

function writeStoredReminders(userId: number | undefined, reminders: StoredActivityReminder[]) {
  if (!userId) {
    return;
  }

  localStorage.setItem(createStorageKey(userId), JSON.stringify(reminders));
}

export function hasActivityReminder(userId: number | undefined, activityId: number) {
  return readStoredReminders(userId).some((item) => item.activityId === activityId);
}

export function saveActivityReminder(
  userId: number | undefined,
  reminder: Omit<StoredActivityReminder, 'createdAt'>,
) {
  if (!userId) {
    return false;
  }

  const current = readStoredReminders(userId);
  if (current.some((item) => item.activityId === reminder.activityId)) {
    return false;
  }

  writeStoredReminders(userId, [
    {
      ...reminder,
      createdAt: new Date().toISOString(),
    },
    ...current,
  ]);

  return true;
}
