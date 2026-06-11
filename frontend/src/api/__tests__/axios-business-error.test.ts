import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import api from '../axios';

describe('api business error handling', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
  });

  it('rejects when backend responds with code 1101 in HTTP 200', async () => {
    mock.onGet('/activities/1/stock').reply(200, {
      code: 1101,
      message: '库存不足，该活动已售罄',
      data: {
        activity_id: 1,
        stock_remaining: 0,
      },
    });

    await expect(api.get('/activities/1/stock')).rejects.toMatchObject({
      code: 1101,
      message: '库存不足，该活动已售罄',
      isBusinessError: true,
      data: {
        activity_id: 1,
        stock_remaining: 0,
      },
    });
  });
});
