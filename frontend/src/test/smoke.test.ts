import { describe, expect, it } from 'vitest';

describe('test setup', () => {
  it('runs in jsdom environment', () => {
    expect(typeof window).toBe('object');
    expect(window.location.pathname).toBe('/');
  });
});
