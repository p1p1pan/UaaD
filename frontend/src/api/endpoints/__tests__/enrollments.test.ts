import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import api from '../../axios';
import {
  createEnrollment,
  getEnrollmentStatus,
  listMyEnrollments,
} from '../enrollments';

describe('enrollments endpoints', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
  });

  it('parses create enrollment accepted response', async () => {
    mock.onPost('/enrollments', { activity_id: 12 }).reply(202, {
      code: 1201,
      message: '已进入排队队列，请等待结果',
      data: {
        status: 'QUEUING',
        queue_position: 18,
        enrollment_id: 345,
        order_no: 'ORD202604130001',
      },
    });

    await expect(createEnrollment(12)).resolves.toEqual({
      code: 1201,
      message: '已进入排队队列，请等待结果',
      status: 'QUEUING',
      queuePosition: 18,
      enrollmentId: 345,
      orderNo: 'ORD202604130001',
      estimatedWaitSeconds: undefined,
      stockRemaining: undefined,
    });
  });

  it('parses enrollment status response', async () => {
    mock.onGet('/enrollments/345/status').reply(200, {
      code: 0,
      message: 'ok',
      data: {
        enrollment_id: 345,
        activity_id: 12,
        status: 'SUCCESS',
        submitted_at: '2026-04-13T12:00:00Z',
        activity_title: 'City Concert',
        order_no: 'ORD202604130001',
        finalized_at: '2026-04-13T12:00:03Z',
      },
    });

    await expect(getEnrollmentStatus(345)).resolves.toEqual({
      enrollmentId: 345,
      activityId: 12,
      status: 'SUCCESS',
      submittedAt: '2026-04-13T12:00:00Z',
      activityTitle: 'City Concert',
      orderNo: 'ORD202604130001',
      finalizedAt: '2026-04-13T12:00:03Z',
    });
  });

  it('parses paginated my enrollments response', async () => {
    mock.onGet('/enrollments', { params: { page: 2, page_size: 5 } }).reply(200, {
      code: 0,
      message: 'ok',
      data: {
        list: [
          {
            id: 1,
            user_id: 99,
            activity_id: 12,
            status: 'QUEUING',
            queue_position: 3,
            enrolled_at: '2026-04-13T12:00:00Z',
            finalized_at: null,
          },
        ],
        total: 11,
        page: 2,
        page_size: 5,
      },
    });

    await expect(listMyEnrollments(2, 5)).resolves.toEqual({
      list: [
        {
          id: 1,
          userId: 99,
          activityId: 12,
          status: 'QUEUING',
          queuePosition: 3,
          enrolledAt: '2026-04-13T12:00:00Z',
          finalizedAt: null,
        },
      ],
      total: 11,
      page: 2,
      pageSize: 5,
    });
  });
});
