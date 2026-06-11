import { delay, http, HttpResponse } from 'msw';

/** 与后端分页信封及 snake_case 字段一致，供 listNotifications 解析 */
const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    title: '报名成功提醒',
    content: '你关注的活动已经开放报名，建议尽快完成锁票。',
    created_at: '2026-04-05T08:00:00Z',
    is_read: false,
    type: 'ACTIVITY_REMINDER',
  },
  {
    id: 2,
    title: '订单即将过期',
    content: '请在 15 分钟内完成支付，逾期后名额将自动释放。',
    created_at: '2026-04-04T12:00:00Z',
    is_read: false,
    type: 'ORDER_EXPIRE',
  },
];

export const notificationHandlers = [
  http.get('http://localhost:8080/api/v1/notifications/unread-count', async () => {
    await delay(120);

    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        unread_count: MOCK_NOTIFICATIONS.filter((item) => !item.is_read).length,
      },
    });
  }),
  http.get('http://localhost:8080/api/v1/notifications', async () => {
    await delay(180);

    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        list: MOCK_NOTIFICATIONS,
        total: MOCK_NOTIFICATIONS.length,
        page: 1,
        page_size: 20,
      },
    });
  }),
  http.put('http://localhost:8080/api/v1/notifications/:id/read', async ({ params }) => {
    await delay(120);

    const targetId = Number(params.id);
    const target = MOCK_NOTIFICATIONS.find((item) => item.id === targetId);

    if (target) {
      target.is_read = true;
    }

    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: null,
    });
  }),
];
