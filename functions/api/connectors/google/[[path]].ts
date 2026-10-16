/** Optional server-only Drive bridge. Never import this module into browser code. */
export interface GoogleConnectorEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_CONNECTOR_SECRET?: string;
  GOOGLE_CONNECTOR_ORIGIN?: string;
}
type Session = { access: string; expires: number };
type Flow = { state: string; verifier: string; expires: number };
const BASE = '/api/connectors/google';
const COOKIE = '__Host-document-drive';
const FLOW = '__Host-document-drive-flow';
const MAX_TEXT = 128 * 1024;
const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const decode = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
const cookie = (name: string, value: string, age: number) =>
  `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const getCookie = (request: Request, name: string) =>
  request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
async function key(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    await crypto.subtle.digest('SHA-256', encoder.encode(secret)),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}
async function seal(value: Session | Flow, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode('access' in value ? COOKIE : FLOW) },
    await key(secret),
    encoder.encode(JSON.stringify(value)),
  );
  return `${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}
async function unseal<T extends { expires: number }>(
  value: string | undefined,
  secret: string,
  purpose: string,
): Promise<T | undefined> {
  try {
    if (!value || value.length > 8000) return;
    const [iv, body, extra] = value.split('.');
    if (extra) return;
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decode(iv), additionalData: encoder.encode(purpose) },
      await key(secret),
      decode(body),
    );
    const result = JSON.parse(new TextDecoder().decode(plaintext)) as T;
    return result.expires > Date.now() ? result : undefined;
  } catch {
    return;
  }
}
class ConnectorError extends Error {
  constructor(
    readonly code: string,
    readonly status = 502,
  ) {
    super(code);
  }
}
async function bounded(response: Response, limit: number) {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw new ConnectorError('source_too_large', 413);
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new ConnectorError('source_too_large', 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(output);
}
async function google(url: string, init: RequestInit, limit = MAX_TEXT) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: 'error' });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ConnectorError(
        response.status === 401 ? 'reconnect_required' : 'service_unavailable',
        response.status === 401 ? 401 : 502,
      );
    }
    return await bounded(response, limit);
  } finally {
    clearTimeout(timeout);
  }
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
function callbackPage(success: boolean) {
  const nonce = random();
  // COOP isolates the popup's opener; BroadcastChannel works without weakening isolation.
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Google Drive</title><p>${success ? 'Connected. You may close this window.' : 'Connection failed. Close this window and try again.'}</p><script nonce="${nonce}">new BroadcastChannel('document-google-connector').postMessage({type:'google-connector-complete',success:${success}});window.close();</script>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
        'Referrer-Policy': 'no-referrer',
      },
    },
  );
}
export async function handleGoogleConnector(request: Request, env: GoogleConnectorEnv): Promise<Response> {
  const url = new URL(request.url);
  const action = url.pathname.slice(BASE.length).replace(/^\//, '');
  const configured = Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.GOOGLE_CONNECTOR_SECRET &&
    env.GOOGLE_CONNECTOR_SECRET.length >= 32 &&
    env.GOOGLE_CONNECTOR_ORIGIN,
  );
  if (!configured) return json({ configured: false, connected: false, error: 'not_configured' }, 503);
  let origin: string;
  try {
    const parsed = new URL(env.GOOGLE_CONNECTOR_ORIGIN!);
    if (parsed.protocol !== 'https:' || parsed.origin !== env.GOOGLE_CONNECTOR_ORIGIN) throw new Error();
    origin = parsed.origin;
  } catch {
    return json({ error: 'not_configured' }, 503);
  }
  if (url.origin !== origin) return json({ error: 'invalid_origin' }, 403);
  const secret = `${env.GOOGLE_CONNECTOR_SECRET!}:${origin}`;
  const redirectUri = `${origin}${BASE}/callback`;
  const methods: Record<string, string> = {
    start: 'POST',
    callback: 'GET',
    status: 'GET',
    list: 'GET',
    read: 'GET',
    disconnect: 'POST',
  };
  if (!methods[action]) return json({ error: 'not_found' }, 404);
  if (request.method !== methods[action]) return json({ error: 'method_not_allowed' }, 405);
  if (request.method === 'POST' && request.headers.get('origin') !== origin)
    return json({ error: 'invalid_origin' }, 403);
  try {
    if (action === 'start') {
      const state = random();
      const verifier = random();
      const flow = await seal({ state, verifier, expires: Date.now() + 10 * 60000 }, secret);
      const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorization.search = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        state,
        code_challenge: encode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier)))),
        code_challenge_method: 'S256',
        access_type: 'online',
      }).toString();
      const response = json({ authorizationUrl: authorization.href });
      response.headers.append('Set-Cookie', cookie(FLOW, flow, 600));
      return response;
    }
    if (action === 'callback') {
      const flow = await unseal<Flow>(getCookie(request, FLOW), secret, FLOW);
      const responseFailure = callbackPage(false);
      responseFailure.headers.append('Set-Cookie', cookie(FLOW, '', 0));
      const code = url.searchParams.get('code');
      if (
        !flow ||
        !code ||
        code.length > 2048 ||
        url.searchParams.get('state') !== flow.state ||
        url.searchParams.has('error')
      )
        return responseFailure;
      try {
        const tokens = JSON.parse(
          await google(
            'https://oauth2.googleapis.com/token',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code,
                client_id: env.GOOGLE_CLIENT_ID!,
                client_secret: env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                code_verifier: flow.verifier,
              }),
            },
            16384,
          ),
        );
        if (
          typeof tokens.access_token !== 'string' ||
          tokens.access_token.length > 3000 ||
          !Number.isFinite(tokens.expires_in) ||
          tokens.expires_in <= 0
        )
          return responseFailure;
        const ttl = Math.min(tokens.expires_in, 3600);
        const response = callbackPage(true);
        response.headers.append('Set-Cookie', cookie(FLOW, '', 0));
        response.headers.append(
          'Set-Cookie',
          cookie(COOKIE, await seal({ access: tokens.access_token, expires: Date.now() + ttl * 1000 }, secret), ttl),
        );
        return response;
      } catch {
        return responseFailure;
      }
    }
    const session = await unseal<Session>(getCookie(request, COOKIE), secret, COOKIE);
    if (action === 'status')
      return json({
        configured: true,
        connected: Boolean(session),
        ...(session ? { expiresAt: session.expires } : {}),
      });
    if (action === 'disconnect') {
      if (session) {
        try {
          await google(
            'https://oauth2.googleapis.com/revoke',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ token: session.access }),
            },
            4096,
          );
        } catch {
          /* Clear the local session even when revocation is unavailable. */
        }
      }
      const response = json({ connected: false });
      response.headers.append('Set-Cookie', cookie(COOKIE, '', 0));
      response.headers.append('Set-Cookie', cookie(FLOW, '', 0));
      return response;
    }
    if (!session) return json({ error: 'reconnect_required' }, 401);
    const headers = { Authorization: `Bearer ${session.access}` };
    if (action === 'list') {
      const search = (url.searchParams.get('q') ?? '').trim();
      if (search.length > 200 || Array.from(search).some((character) => character.charCodeAt(0) < 32))
        return json({ error: 'invalid_query' }, 400);
      const literal = search.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const upstream = new URL('https://www.googleapis.com/drive/v3/files');
      upstream.search = new URLSearchParams({
        pageSize: '30',
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size)',
        q:
          "trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'text/markdown' or mimeType = 'text/csv' or mimeType = 'application/json')" +
          (search ? ` and name contains '${literal}'` : ''),
        ...(url.searchParams.get('pageToken') ? { pageToken: url.searchParams.get('pageToken')!.slice(0, 2048) } : {}),
      }).toString();
      const result = JSON.parse(await google(upstream.href, { headers }));
      return json({ files: result.files ?? [], nextPageToken: result.nextPageToken });
    }
    const id = url.searchParams.get('id');
    if (!id || !/^[a-zA-Z0-9_-]{1,200}$/.test(id)) return json({ error: 'invalid_file' }, 400);
    const metadata = JSON.parse(
      await google(
        `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,size,modifiedTime`,
        { headers },
        16384,
      ),
    );
    const doc = metadata.mimeType === 'application/vnd.google-apps.document';
    if (!doc && !['text/plain', 'text/markdown', 'text/csv', 'application/json'].includes(metadata.mimeType))
      return json({ error: 'unsupported_file' }, 415);
    if (Number(metadata.size) > MAX_TEXT) return json({ error: 'source_too_large' }, 413);
    const text = await google(
      `https://www.googleapis.com/drive/v3/files/${id}${doc ? '/export?mimeType=text%2Fplain' : '?alt=media'}`,
      { headers },
    );
    return json({ id, name: metadata.name, mimeType: metadata.mimeType, modifiedTime: metadata.modifiedTime, text });
  } catch (error) {
    return json(
      { error: error instanceof ConnectorError ? error.code : 'service_unavailable' },
      error instanceof ConnectorError ? error.status : 502,
    );
  }
}
export const onRequest = ({ request, env }: { request: Request; env: GoogleConnectorEnv }) =>
  handleGoogleConnector(request, env);
