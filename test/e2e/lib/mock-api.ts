import { createServer, type Server } from 'node:http';
import type { Page, Route } from '@playwright/test';

type ApiRequest = Pick<ReturnType<Route['request']>, 'url' | 'method' | 'postData' | 'postDataJSON'>;
export type ApiRoute = { request(): ApiRequest; fulfill(options: Parameters<Route['fulfill']>[0]): Promise<void> };
type Handler = (route: ApiRoute) => unknown;
const servers = new WeakMap<
  Page,
  { server: Server; origin: string; handlers: Array<{ match: RegExp; handler: Handler }> }
>();

/**
 * Serve fake API responses over real HTTP. WebKit does not deliver SW-controlled
 * fetches to page.route, even when the SW lets the cross-origin request through.
 * Only explicitly registered API URLs are rewritten; browser fetch still owns
 * CORS, response streams and AbortSignal. Production worker control stays on.
 */
export async function mockApi(page: Page, pattern: string, handler: Handler): Promise<void> {
  let state = servers.get(page);
  if (!state) {
    const handlers: Array<{ match: RegExp; handler: Handler }> = [];
    const server = createServer(async (request, response) => {
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Headers', request.headers['access-control-request-headers'] || '*');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      if (request.method === 'OPTIONS') {
        response.writeHead(204).end();
        return;
      }
      const original = new URL(request.url!, 'http://fixture').searchParams.get('url') || '';
      const target = [...handlers].reverse().find(({ match }) => match.test(original));
      if (!target) {
        response.writeHead(500).end('Unregistered API fixture URL');
        return;
      }
      const chunks: Buffer[] = [];
      try {
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks).toString();
        await target.handler({
          request: () => ({
            url: () => original,
            method: () => request.method!,
            postData: () => body || null,
            postDataJSON: () => JSON.parse(body),
          }),
          fulfill: async (options = {}) => {
            if (response.destroyed) return;
            for (const [key, value] of Object.entries(options.headers || {})) response.setHeader(key, value);
            if (options.contentType) response.setHeader('Content-Type', options.contentType);
            if (options.json !== undefined) response.setHeader('Content-Type', 'application/json');
            response.writeHead(options.status || 200);
            response.end(options.json !== undefined ? JSON.stringify(options.json) : options.body || '');
          },
        });
      } catch (error) {
        if (!response.destroyed) response.writeHead(500).end(String(error));
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    state = { server, origin: `http://127.0.0.1:${address.port}`, handlers };
    servers.set(page, state);
    page.once('close', () => {
      server.closeAllConnections();
      server.close();
    });
  }
  const source =
    '^' +
    pattern
      .split('**')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*') +
    '$';
  state.handlers.push({ match: new RegExp(source), handler });
  const options = { source, origin: state.origin };
  const install = ({ source, origin }: typeof options) => {
    const root = window as Window & { __apiFixtures?: Array<{ source: string; origin: string }> };
    if (!root.__apiFixtures) {
      root.__apiFixtures = [];
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        let url: string;
        try {
          url = input instanceof Request ? input.url : new URL(String(input), location.href).href;
        } catch {
          return nativeFetch(input, init);
        }
        const fixture = [...root.__apiFixtures!].reverse().find(({ source }) => new RegExp(source).test(url));
        if (!fixture) return nativeFetch(input, init);
        const rewritten = `${fixture.origin}/?url=${encodeURIComponent(url)}`;
        if (!(input instanceof Request)) return nativeFetch(rewritten, init);
        const request = new Request(input, init);
        return request.arrayBuffer().then((body) =>
          nativeFetch(rewritten, {
            method: request.method,
            headers: request.headers,
            signal: request.signal,
            mode: request.mode,
            credentials: request.credentials,
            cache: request.cache,
            redirect: request.redirect,
            referrer: request.referrer,
            referrerPolicy: request.referrerPolicy,
            integrity: request.integrity,
            keepalive: request.keepalive,
            body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
          }),
        );
      };
    }
    root.__apiFixtures.push({ source, origin });
  };
  await page.addInitScript(install, options);
  await page.evaluate(install, options);
}
