import MockAdapter from 'axios-mock-adapter';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import api from '../axios';
import { AUTH_LOGOUT_EVENT } from '../../constants/authEvents';

describe('api 401 handling', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    localStorage.setItem('token', 'fake-token');
  });

  afterEach(() => {
    mock.restore();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('clears token and dispatches logout event on 401', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    mock.onGet('/secure-resource').reply(401, {
      code: 1002,
      message: 'unauthorized',
      data: null,
    });

    await expect(api.get('/secure-resource')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(dispatchSpy).toHaveBeenCalled();

    const [event] = dispatchSpy.mock.calls[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect((event as CustomEvent).type).toBe(AUTH_LOGOUT_EVENT);
  });
});
