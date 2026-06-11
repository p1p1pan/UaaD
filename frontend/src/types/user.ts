export type UserRole = 'USER' | 'MERCHANT' | 'SYS_ADMIN';

export interface UserProfile {
  userId: number;
  phone: string;
  username: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  userId: number;
  username: string;
  role: UserRole;
}

export interface UserPreferences {
  avatarDataUrl: string;
  email: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

export function normalizeUserRole(role: string | null | undefined): UserRole {
  const normalized = role?.toUpperCase();

  if (normalized === 'MERCHANT') {
    return 'MERCHANT';
  }

  if (normalized === 'SYS_ADMIN' || normalized === 'ADMIN') {
    return 'SYS_ADMIN';
  }

  return 'USER';
}
