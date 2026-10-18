#!/usr/bin/env node
// Usage: node bin/wait-for-deploy.mjs SITE EXACT_REVISION [WAIT_MS] [INTERVAL_MS]
// Source SHA is compared exactly; the digest records that host's actual build
// bytes (SW timestamps and Docker's WASM encoding intentionally differ).
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

try {
  const [site, revision, budget = '1200000', interval = '20000'] = process.argv.slice(2);
  if (!/^[a-f0-9]{40,64}$/.test(revision || '')) throw new Error('Exact source revision is required');
  const waitMs = Number(budget);
  const intervalMs = Number(interval);
  if (!(waitMs > 0 && Number.isFinite(waitMs) && intervalMs > 0 && Number.isFinite(intervalMs)))
    throw new Error('Invalid polling budget');
  const marker = new URL('build-identity.json', site.endsWith('/') ? site : site + '/');
  if (!['http:', 'https:'].includes(marker.protocol)) throw new Error('HTTP site is required');
  const deadline = Date.now() + waitMs;
  let reason = 'identity missing';
  while (Date.now() < deadline) {
    marker.searchParams.set('deploy', randomUUID());
    try {
      const response = await fetch(marker, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
        signal: AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - Date.now()))),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const live = await response.json();
      if (live.schema !== 1 || !/^[a-f0-9]{64}$/.test(live.contentSha256 || ''))
        throw new Error('Invalid build identity');
      if (live.revision === revision) {
        console.log(`Deployment live: ${revision} (${live.contentSha256})`);
        process.exit(0);
      }
      reason = `stale revision ${live.revision}`;
    } catch (error) {
      reason = error.message;
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await delay(Math.min(intervalMs, remaining));
  }
  throw new Error(`Deployment timed out: expected ${revision}; ${reason}`);
} catch (error) {
  console.error(`::error::Deploy gate failed: ${error.message}`);
  process.exit(1);
}
