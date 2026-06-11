import type { EnrollmentStatusItem, OrderItem } from '../../types';

let enrollmentSeq = 5000;
let orderSeq = 9000;

const enrollments: EnrollmentStatusItem[] = [];
const orders: OrderItem[] = [];

function createOrderNo() {
  const serial = String(orderSeq).padStart(8, '0');
  return `ORD${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${serial}`;
}

export function createMockEnrollment(activityId: number) {
  enrollmentSeq += 1;
  orderSeq += 1;

  const now = new Date().toISOString();
  const orderId = orderSeq;
  const orderNo = createOrderNo();

  const enrollment: EnrollmentStatusItem = {
    enrollmentId: enrollmentSeq,
    activityId,
    activityTitle: `UAAD Activity #${activityId}`,
    status: 'SUCCESS',
    submittedAt: now,
    finalizedAt: now,
    orderNo,
  };

  const order: OrderItem = {
    id: orderId,
    orderNo,
    enrollmentId: enrollment.enrollmentId,
    activityId,
    amount: 380,
    status: 'PENDING',
    paidAt: null,
    expiredAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
  };

  enrollments.unshift(enrollment);
  orders.unshift(order);

  return { enrollment, order };
}

export function getMockEnrollmentById(id: number) {
  return enrollments.find((item) => item.enrollmentId === id) ?? null;
}

export function listMockOrders() {
  return orders;
}

export function getMockOrderById(id: number) {
  return orders.find((item) => item.id === id) ?? null;
}

export function payMockOrder(id: number) {
  const target = getMockOrderById(id);
  if (!target) {
    return null;
  }

  const paidAt = new Date().toISOString();
  target.status = 'PAID';
  target.paidAt = paidAt;
  target.updatedAt = paidAt;
  return target;
}
