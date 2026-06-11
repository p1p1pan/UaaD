import { delay, http, HttpResponse } from 'msw';
import { createMockEnrollment, getMockEnrollmentById } from './commerce';

export const enrollmentHandlers = [
  http.post('http://localhost:8080/api/v1/enrollments', async ({ request }) => {
    await delay(220);
    const body = (await request.json()) as { activity_id?: number };
    const activityId = Number(body.activity_id ?? 0);

    if (!activityId) {
      return HttpResponse.json(
        { code: 1001, message: 'invalid activity id', data: null },
        { status: 400 },
      );
    }

    const { enrollment, order } = createMockEnrollment(activityId);

    return HttpResponse.json(
      {
        code: 1201,
        message: '已进入排队队列，请等待结果',
        data: {
          enrollment_id: enrollment.enrollmentId,
          status: enrollment.status,
          order_no: order.orderNo,
        },
      },
      { status: 202 },
    );
  }),
  http.get('http://localhost:8080/api/v1/enrollments/:id/status', async ({ params }) => {
    await delay(180);
    const enrollmentId = Number(params.id);
    const enrollment = getMockEnrollmentById(enrollmentId);

    if (!enrollment) {
      return HttpResponse.json(
        { code: 1004, message: 'enrollment not found', data: null },
        { status: 404 },
      );
    }

    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        enrollment_id: enrollment.enrollmentId,
        activity_id: enrollment.activityId,
        activity_title: enrollment.activityTitle,
        status: enrollment.status,
        submitted_at: enrollment.submittedAt,
        finalized_at: enrollment.finalizedAt,
        order_no: enrollment.orderNo,
      },
    });
  }),
];
