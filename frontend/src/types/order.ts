export type OrderStatus = 'PENDING' | 'PAID' | 'CLOSED' | 'REFUNDED';

export interface OrderItem {
  id: number;
  orderNo: string;
  enrollmentId: number;
  activityId: number;
  amount: number;
  status: OrderStatus;
  paidAt?: string | null;
  expiredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderListResult {
  list: OrderItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PayOrderResult {
  orderNo: string;
  status: OrderStatus;
  paidAt: string;
}
