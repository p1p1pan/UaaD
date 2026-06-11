import api from '../axios';
import type { OrderItem, OrderListResult, OrderStatus, PayOrderResult } from '../../types';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface BackendOrder {
  id: number;
  order_no: string;
  enrollment_id: number;
  activity_id: number;
  amount: number;
  status: OrderStatus;
  paid_at?: string | null;
  expired_at: string;
  created_at: string;
  updated_at: string;
}

interface BackendOrderListData {
  list: BackendOrder[];
  total: number;
  page: number;
  page_size: number;
}

interface BackendPayResult {
  order_no: string;
  status: OrderStatus;
  paid_at: string;
}

function normalizeOrder(order: BackendOrder): OrderItem {
  return {
    id: order.id,
    orderNo: order.order_no,
    enrollmentId: order.enrollment_id,
    activityId: order.activity_id,
    amount: order.amount,
    status: order.status,
    paidAt: order.paid_at ?? null,
    expiredAt: order.expired_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function listOrders(page = 1, pageSize = 20): Promise<OrderListResult> {
  const response = await api.get<ApiResponse<BackendOrderListData>>('/orders', {
    params: {
      page,
      page_size: pageSize,
    },
  });

  return {
    list: response.data.data.list.map(normalizeOrder),
    total: response.data.data.total,
    page: response.data.data.page,
    pageSize: response.data.data.page_size,
  };
}

export async function getOrderDetail(orderId: number): Promise<OrderItem> {
  const response = await api.get<ApiResponse<BackendOrder>>(`/orders/${orderId}`);
  return normalizeOrder(response.data.data);
}

export async function payOrder(orderId: number): Promise<PayOrderResult> {
  const response = await api.post<ApiResponse<BackendPayResult>>(`/orders/${orderId}/pay`);

  return {
    orderNo: response.data.data.order_no,
    status: response.data.data.status,
    paidAt: response.data.data.paid_at,
  };
}

export async function findOrderByOrderNo(orderNo: string, pageSize = 100): Promise<OrderItem | null> {
  const result = await listOrders(1, pageSize);
  return result.list.find((item) => item.orderNo === orderNo) ?? null;
}
