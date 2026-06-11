import { delay, http, HttpResponse } from 'msw';

const MOCK_ACCOUNTS = [
  {
    phone: '13800000001',
    password: 'user123',
    user_id: 1001,
    username: '测试用户',
    role: 'user',
    token: 'mock-token-user-1001',
  },
  {
    phone: '13800000002',
    password: 'merchant123',
    user_id: 2001,
    username: '测试商家',
    role: 'merchant',
    token: 'mock-token-merchant-2001',
  },
];

export const authHandlers = [
  http.post('http://localhost:8080/api/v1/auth/login', async ({ request }) => {
    await delay(300);

    const body = (await request.json()) as { phone?: string; password?: string };
    const account = MOCK_ACCOUNTS.find(
      (a) => a.phone === body.phone && a.password === body.password,
    );

    if (!account) {
      return HttpResponse.json(
        { code: 1001, message: '手机号或密码错误', data: null },
        { status: 401 },
      );
    }

    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        token: account.token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        user_id: account.user_id,
        role: account.role,
        username: account.username,
      },
    });
  }),
  http.get('http://localhost:8080/api/v1/auth/profile', async ({ request }) => {
    await delay(180);

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const account = MOCK_ACCOUNTS.find((item) => item.token === token);

    if (!account) {
      return HttpResponse.json(
        { code: 401, message: '未登录', data: null },
        { status: 401 },
      );
    }

    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        user_id: account.user_id,
        phone: account.phone,
        username: account.username,
        role: account.role,
        created_at: '2026-01-15T09:00:00Z',
      },
    });
  }),
];
