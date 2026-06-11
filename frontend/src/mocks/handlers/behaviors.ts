import { delay, http, HttpResponse } from 'msw';

type BehaviorType = 'VIEW' | 'COLLECT' | 'SHARE' | 'CLICK' | 'SEARCH';

interface BehaviorItem {
  activity_id?: number;
  behavior_type?: BehaviorType;
  detail?: Record<string, unknown>;
  timestamp?: number;
}

function isValidBehavior(payload: BehaviorItem | undefined): payload is BehaviorItem {
  const behaviorTypes: BehaviorType[] = ['VIEW', 'COLLECT', 'SHARE', 'CLICK', 'SEARCH'];
  return Boolean(
    payload &&
      typeof payload.activity_id === 'number' &&
      payload.activity_id > 0 &&
      typeof payload.behavior_type === 'string' &&
      behaviorTypes.includes(payload.behavior_type),
  );
}

export const behaviorHandlers = [
  http.post('http://localhost:8080/api/v1/behaviors', async ({ request }) => {
    await delay(60);
    const body = (await request.json()) as BehaviorItem;

    if (!isValidBehavior(body)) {
      return HttpResponse.json(
        { code: 1001, message: '请求参数错误', data: null },
        { status: 400 },
      );
    }

    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: { accepted: true },
    });
  }),
  http.post('http://localhost:8080/api/v1/behaviors/batch', async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as { behaviors?: BehaviorItem[] };
    const list = body.behaviors;

    if (!Array.isArray(list) || list.length === 0 || list.length > 100) {
      return HttpResponse.json(
        { code: 1001, message: '请求参数错误', data: null },
        { status: 400 },
      );
    }

    if (!list.every((item) => isValidBehavior(item))) {
      return HttpResponse.json(
        { code: 1001, message: '请求参数错误', data: null },
        { status: 400 },
      );
    }

    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: { accepted: true, count: list.length },
    });
  }),
];
