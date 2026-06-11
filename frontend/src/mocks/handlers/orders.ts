import { delay, http, HttpResponse } from 'msw';
import { getMockOrderById, listMockOrders, payMockOrder } from './commerce';

export const orderHandlers = [
  http.get('http://localhost:8080/api/v1/orders', async ({ request }) => {
    await delay(180);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('page_size') ?? '20');
    const orders = listMockOrders();
    const start = (page - 1) * pageSize;

    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        list: orders.slice(start, start + pageSize).map((item) => ({
          id: item.id,
          order_no: item.orderNo,
          enrollment_id: item.enrollmentId,
          activity_id: item.activityId,
          amount: item.amount,
          status: item.status,
          paid_at: item.paidAt,
          expired_at: item.expiredAt,
          created_at: item.createdAt,
          updated_at: item.updatedAt,
        })),
        total: orders.length,
        page,
        page_size: pageSize,
      },
    });
  }),
  http.get('http://localhost:8080/api/v1/orders/:id', async ({ params }) => {
    await delay(160);
    const order = getMockOrderById(Number(params.id));

    if (!order) {
      return HttpResponse.json(
        { code: 1004, message: 'order not found', data: null },
        { status: 404 },
      );
    }

    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        id: order.id,
        order_no: order.orderNo,
        enrollment_id: order.enrollmentId,
        activity_id: order.activityId,
        amount: order.amount,
        status: order.status,
        paid_at: order.paidAt,
        expired_at: order.expiredAt,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      },
    });
  }),
  http.post('http://localhost:8080/api/v1/orders/:id/pay', async ({ params }) => {
    await delay(220);
    const order = payMockOrder(Number(params.id));

    if (!order) {
      return HttpResponse.json(
        { code: 1004, message: 'order not found', data: null },
        { status: 404 },
      );
    }

    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        order_no: order.orderNo,
        status: order.status,
        paid_at: order.paidAt,
      },
    });
  }),
];
