export interface NotificationBadgeState {
  unreadCount: number;
  isLoading: boolean;
}

export interface NotificationItem {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  type: 'ENROLL_SUCCESS' | 'ENROLL_FAIL' | 'ORDER_EXPIRE' | 'ACTIVITY_REMINDER';
}

export type NotificationFilter = 'ALL' | 'UNREAD' | 'READ';
