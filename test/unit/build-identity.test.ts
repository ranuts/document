import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';

const revision = 'a'.repeat(40);
function run(script: string, args: string[], env = {}) {
  return new Promise<{ code: number | null; output: string }>((done) => {
    const child = spawn(process.execPath, [resolve('bin', script), ...args], {
      env: { ...process.env, ...env },
    });
    let output = '';
    child.stdout.on('data', (part) => (output += part));
    child.stderr.on('data', (part) => (output += part));
    child.on('close', (code) => done({ code, output }));
  });
}
it('records the actual served tree, including vendor, SW and static-only changes without output-path drift', async () => {
  const root = await mkdtemp(join(tmpdir(), 'build-identity-'));
  try {
    const generate = async (dir: string) => {
      const result = await run('build-identity.mjs', [dir], { BUILD_REVISION: revision });
      expect(result.code, result.output).toBe(0);
      return JSON.parse(await readFile(join(dir, 'build-identity.json'), 'utf8'));
    };
    const dirs = [join(root, 'first'), join(root, 'second')];
    for (const dir of dirs) {
      await mkdir(join(dir, 'sdkjs'), { recursive: true });
      await writeFile(join(dir, 'sdkjs/vendor.js'), 'vendor');
      await writeFile(join(dir, 'sw.js'), 'worker');
      await writeFile(join(dir, 'help.html'), 'static');
    }
    const first = await generate(dirs[0]);
    expect(first).toEqual({ schema: 1, revision, contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(await generate(dirs[1])).toEqual(first);
    expect(await generate(dirs[0])).toEqual(first); // marker never hashes itself
    let previous = first.contentSha256;
    for (const file of ['sdkjs/vendor.js', 'sw.js', 'help.html']) {
      await writeFile(join(dirs[0], file), 'changed');
      const current = await generate(dirs[0]);
      expect(current.revision).toBe(revision);
      expect(current.contentSha256).not.toBe(previous);
      previous = current.contentSha256;
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('polls the actual HTTP marker with a unique cache bypass and fails stale, absent, malformed, error and hanging deployments', async () => {
  let mode = 'eventual';
  let polls = 0;
  const urls: string[] = [];
  const headers: string[] = [];
  const sockets = new Set<import('node:net').Socket>();
  const server = createServer((req, res) => {
    polls++;
    urls.push(req.url!);
    headers.push(String(req.headers['cache-control']));
    if (mode === 'hang') return;
    if (mode === 'error' || mode === 'missing') res.statusCode = mode === 'error' ? 503 : 404;
    const liveRevision = mode === 'stale' || (mode === 'eventual' && polls === 1) ? 'b'.repeat(40) : revision;
    res.end(
      mode === 'malformed'
        ? '<html>fallback</html>'
        : JSON.stringify({
            schema: mode === 'unsupported' ? 2 : 1,
            revision: liveRevision,
            contentSha256: mode === 'digestless' ? undefined : 'c'.repeat(64),
          }),
    );
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as import('node:net').AddressInfo).port;
  try {
    const url = `http://127.0.0.1:${port}/`;
    const good = await run('wait-for-deploy.mjs', [url, revision, '600', '10']);
    expect(good.code, good.output).toBe(0);
    expect(polls).toBeGreaterThan(1);
    expect(urls.every((url) => url.startsWith('/build-identity.json?deploy='))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
    expect(headers.every((header) => /no-cache|no-store/.test(header))).toBe(true);
    for (mode of ['stale', 'missing', 'malformed', 'unsupported', 'digestless', 'error', 'hang']) {
      const bad = await run('wait-for-deploy.mjs', [url, revision, '160', '10']);
      expect(bad.code, mode + bad.output).toBe(1);
      expect(bad.output).toMatch(/deploy.*(failed|timed out)|deployment.*(failed|timed out)/i);
    }
    expect((await run('wait-for-deploy.mjs', [url, '', '100', '10'])).code).toBe(1);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((done) => server.close(() => done()));
  }
}, 15_000);

it('bypasses the real service worker handler for the identity route, including cache-busting queries', async () => {
  const { runInNewContext } = await import('node:vm');
  const handlers: Record<string, (event: unknown) => void> = {};
  runInNewContext(await readFile(resolve('public/sw.js'), 'utf8'), {
    self: {
      location: { origin: 'https://example.com' },
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        handlers[type] = handler;
      },
    },
    URL,
    Date,
  });
  for (const query of ['', '?deploy=nonce']) {
    let intercepted = false;
    handlers.fetch({
      request: { method: 'GET', url: 'https://example.com/build-identity.json' + query },
      respondWith: () => {
        intercepted = true;
      },
    });
    expect(intercepted).toBe(false);
  }
});

it('uses actual checkout HEAD over a synthetic GitHub event SHA and identifies metadata-free archives by content', async () => {
  const { execFileSync } = await import('node:child_process');
  const root = await mkdtemp(join(tmpdir(), 'build-revision-'));
  try {
    const output = join(root, 'dist');
    await mkdir(output);
    await writeFile(join(output, 'index.html'), 'built');
    const env = { BUILD_REVISION: '', GITHUB_SHA: 'b'.repeat(40), CF_PAGES_COMMIT_SHA: '' };
    const local = await run('build-identity.mjs', [output], env);
    expect(local.code, local.output).toBe(0);
    const identity = JSON.parse(await readFile(join(output, 'build-identity.json'), 'utf8'));
    expect(identity.revision).toBe(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
    const script = join(root, 'build-identity.mjs');
    await copyFile(resolve('bin/build-identity.mjs'), script);
    const archive = await run(script, [output], env);
    expect(archive.code, archive.output).toBe(0);
    expect(JSON.parse(await readFile(join(output, 'build-identity.json'), 'utf8')).revision).toBe(
      'content:' + identity.contentSha256,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
