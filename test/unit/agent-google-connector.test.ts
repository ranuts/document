import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGoogleConnector, type GoogleConnectorEnv } from '../../functions/api/connectors/google/[[path]]';
const origin = 'https://editor.example';
const env: GoogleConnectorEnv = {
  GOOGLE_CLIENT_ID: 'client',
  GOOGLE_CLIENT_SECRET: 'secret-client',
  GOOGLE_CONNECTOR_SECRET: 'test-secret-at-least-thirty-two-characters',
  GOOGLE_CONNECTOR_ORIGIN: origin,
};
const request = (path: string, options: RequestInit = {}) =>
  new Request(`${origin}/api/connectors/google/${path}`, options);
const post = (path: string) => request(path, { method: 'POST', headers: { origin } });
async function start() {
  const response = await handleGoogleConnector(post('start'), env);
  const { authorizationUrl } = await response.json();
  return { url: new URL(authorizationUrl), cookie: response.headers.get('set-cookie')!.split(';')[0] };
}
async function connect() {
  const flow = await start();
  const response = await handleGoogleConnector(
    request(`callback?code=one-time&state=${flow.url.searchParams.get('state')}`, { headers: { cookie: flow.cookie } }),
    env,
  );
  const cookies = response.headers.getSetCookie();
  return { response, cookie: cookies.find((item) => item.startsWith('__Host-document-drive='))!.split(';')[0] };
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('optional Google Drive server connector', () => {
  it('reports missing/invalid deployment without requiring a site account', async () => {
    expect((await handleGoogleConnector(request('status'), {})).status).toBe(503);
    expect(
      (await handleGoogleConnector(request('status'), { ...env, GOOGLE_CONNECTOR_ORIGIN: 'http://editor.example' }))
        .status,
    ).toBe(503);
    expect(await (await handleGoogleConnector(request('status'), env)).json()).toEqual({
      configured: true,
      connected: false,
    });
  });
  it('requires explicit same-origin POST and uses PKCE + encrypted HttpOnly flow', async () => {
    expect((await handleGoogleConnector(request('start'), env)).status).toBe(405);
    expect((await handleGoogleConnector(request('start', { method: 'POST' }), env)).status).toBe(403);
    expect(
      (
        await handleGoogleConnector(
          new Request('https://evil.example/api/connectors/google/start', { method: 'POST', headers: { origin } }),
          env,
        )
      ).status,
    ).toBe(403);
    const flow = await start();
    expect(flow.url.origin).toBe('https://accounts.google.com');
    expect(flow.url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(flow.cookie).not.toContain(flow.url.searchParams.get('state'));
    expect(flow.url.searchParams.has('client_secret')).toBe(false);
    const response = await handleGoogleConnector(post('start'), env);
    expect(response.headers.get('set-cookie')).toContain('Secure; HttpOnly; SameSite=Lax');
  });
  it('rejects tampered, mismatched, missing and expired callback state without exchange', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const flow = await start();
    for (const [state, cookie] of [
      ['wrong', flow.cookie],
      [flow.url.searchParams.get('state'), flow.cookie + 'x'],
      [flow.url.searchParams.get('state'), ''],
    ]) {
      const response = await handleGoogleConnector(
        request(`callback?code=code&state=${state}`, { headers: { cookie: cookie! } }),
        env,
      );
      expect(await response.text()).toContain('Connection failed');
      expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    }
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60000);
    expect(
      await (
        await handleGoogleConnector(
          request(`callback?code=code&state=${flow.url.searchParams.get('state')}`, {
            headers: { cookie: flow.cookie },
          }),
          env,
        )
      ).text(),
    ).toContain('Connection failed');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps access tokens server-only and rejects replay without flow cookie', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ access_token: 'private-token', expires_in: 3600 })));
    vi.stubGlobal('fetch', fetcher);
    const { response, cookie } = await connect();
    const html = await response.text();
    expect(html).toContain('BroadcastChannel');
    expect(html).not.toContain('private-token');
    expect(response.headers.get('content-security-policy')).toContain("script-src 'nonce-");
    expect(cookie).not.toContain('private-token');
    const status = await (await handleGoogleConnector(request('status', { headers: { cookie } }), env)).json();
    expect(status.connected).toBe(true);
    expect(JSON.stringify(status)).not.toContain('private-token');
    expect(await (await handleGoogleConnector(request('callback?code=one-time&state=old'), env)).text()).toContain(
      'Connection failed',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][1].body)).toContain('code_verifier=');
  });
  it('lists supported resources, exports documents, bounds bytes, and never fetches supplied URLs', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'private-token', expires_in: 3600 })));
    vi.stubGlobal('fetch', fetcher);
    const { cookie } = await connect();
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ files: [{ id: 'abc', name: 'Plan', mimeType: 'text/plain' }] })),
    );
    expect(
      (await (await handleGoogleConnector(request('list', { headers: { cookie } }), env)).json()).files[0].id,
    ).toBe('abc');
    expect(fetcher.mock.calls[1][0]).toContain('https://www.googleapis.com/drive/v3/files?');
    fetcher
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ mimeType: 'application/vnd.google-apps.document', name: 'Plan' })),
      )
      .mockResolvedValueOnce(new Response('Document text'));
    expect(
      (await (await handleGoogleConnector(request('read?id=abc', { headers: { cookie } }), env)).json()).text,
    ).toBe('Document text');
    expect(fetcher.mock.calls[3][0]).toContain('/abc/export?mimeType=text%2Fplain');
    const count = fetcher.mock.calls.length;
    expect(
      (await handleGoogleConnector(request('read?id=https://evil.example', { headers: { cookie } }), env)).status,
    ).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(count);
    fetcher
      .mockResolvedValueOnce(new Response(JSON.stringify({ mimeType: 'text/plain' })))
      .mockResolvedValueOnce(new Response('x'.repeat(131073)));
    expect((await handleGoogleConnector(request('read?id=abc', { headers: { cookie } }), env)).status).toBe(413);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ mimeType: 'application/pdf' })));
    expect((await handleGoogleConnector(request('read?id=abc', { headers: { cookie } }), env)).status).toBe(415);
  });
  it('escapes bounded Drive filename search as one literal and rejects oversized queries', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 })));
    vi.stubGlobal('fetch', fetcher);
    const { cookie } = await connect();
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ files: [] })));
    const query = "a' or trashed = true or name contains 'b\\c";
    const response = await handleGoogleConnector(
      request(`list?q=${encodeURIComponent(query)}`, { headers: { cookie } }),
      env,
    );
    expect(response.status).toBe(200);
    const sent = new URL(fetcher.mock.calls[1][0]).searchParams.get('q')!;
    expect(sent).toContain("name contains 'a\\' or trashed = true or name contains \\'b\\\\c'");
    expect(
      (await handleGoogleConnector(request(`list?q=${'x'.repeat(201)}`, { headers: { cookie } }), env)).status,
    ).toBe(400);
  });
  it('clears sessions despite revoke failure, hides upstream bodies, and expires sessions', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'private-token', expires_in: 1 })));
    vi.stubGlobal('fetch', fetcher);
    const { cookie } = await connect();
    fetcher.mockResolvedValueOnce(new Response('private failure', { status: 503 }));
    expect(await (await handleGoogleConnector(request('list', { headers: { cookie } }), env)).json()).toEqual({
      error: 'service_unavailable',
    });
    fetcher.mockRejectedValueOnce(new Error('private'));
    const response = await handleGoogleConnector(new Request(post('disconnect'), { headers: { origin, cookie } }), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2000);
    expect((await handleGoogleConnector(request('list', { headers: { cookie } }), env)).status).toBe(401);
  });
});
