import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { secureEditorHtml } from '../../bin/editor-csp.mjs';
it('places the policy before scripts and allows only exact inline script hashes', () => {
  const code = '\nwindow.theme = "dark";\n';
  const html = `<html><head><script>${code}</script><script src="/app.js"></script></head></html>`;
  const result = secureEditorHtml(html);
  const hash = createHash('sha256').update(code).digest('base64');
  expect(result.indexOf('Content-Security-Policy')).toBeLessThan(result.indexOf('<script>'));
  expect(result).toContain(`'sha256-${hash}'`);
  expect(result).toContain("script-src-attr 'none'");
  expect(result).toContain("'wasm-unsafe-eval'");
  expect(result).not.toContain("'unsafe-eval'");
  expect(result).not.toContain("script-src 'self' https:");
});
it('does not silently create intersecting policies', () => {
  expect(() =>
    secureEditorHtml('<head><meta http-equiv="Content-Security-Policy" content="default-src none"></head>'),
  ).toThrow(/already/);
});
it('rejects documents without an early policy insertion point', () => {
  expect(() => secureEditorHtml('<script>alert(1)</script>')).toThrow(/head/);
});

it('allows embedded-image byte reads without allowing data scripts or workers', () => {
  const html = secureEditorHtml('<html><head><script src="/app.js"></script></head></html>');
  const policy = html.match(/content="([^"]+)"/)![1];
  const directives = new Map(
    policy.split(';').map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }),
  );
  expect(directives.get('connect-src')).toContain('data:');
  expect(directives.get('script-src')).not.toContain('data:');
  expect(directives.get('worker-src')).not.toContain('data:');
});

it('permits the Cloudflare analytics script without permitting arbitrary external scripts', () => {
  const html = secureEditorHtml('<html><head></head></html>');
  const policy = html.match(/content="([^"]+)"/)![1];
  const directives = new Map(
    policy.split(';').map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }),
  );
  expect(directives.get('script-src')).toEqual([
    "'self'",
    "'wasm-unsafe-eval'",
    'https://static.cloudflareinsights.com',
  ]);
  expect(directives.get('connect-src')).toContain("'self'");
  expect(directives.get('connect-src')).toContain('https:');
  expect(directives.get('script-src-attr')).toEqual(["'none'"]);
});
