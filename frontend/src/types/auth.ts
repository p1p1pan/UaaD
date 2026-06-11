export type AuthRole = 'USER' | 'MERCHANT' | 'SYS_ADMIN' | string;

export interface AuthSession {
  token: string;
  expiresAt: string | null;
  userId: number | null;
  role: AuthRole | null;
  username: string | null;
}
