import { describe, expect, it } from 'vitest';

describe('vitest setup', () => {
  it('runs in a browser-like environment', () => {
    expect(window.location.href).toBe('http://localhost:3000/');
    expect(URL.createObjectURL(new Blob())).toBe('blob:vitest-document');
  });
});
