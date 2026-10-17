# PR 279: first-visit editor cache race

The Docker E2E run at commit `5ae9dfdf` failed its landing-page cache assertion
in shard 2. The other 109 cases in that shard passed. The retained trace from
GitHub Actions run `39027953673` showed that the sole missing entry was
`/sdkjs/common/libfont/engine/fonts.js`.

The font request succeeded, but occurred after `serviceWorker.ready` resolved
and before `clients.claim()` controlled the first-visit page. It populated only
the browser HTTP cache. The prefetcher's request deduplication then prevented a
controlled retry that would populate the worker's offline cache.

`public/landing-prefetch.js` now waits for actual page control before issuing
warm-up requests. It installs the control listener before rechecking the
controller, removes listeners when settled, and cancels the wait on departure
or worker upgrade. Resuming keeps the URL eligible for a new request. Existing
controlled pages continue immediately, and the upgrade gate still applies.

Two deterministic regressions first failed against the previous implementation:
one verifies that a resolved readiness promise cannot start an uncontrolled
fetch; the other checks cancellation, late control changes and retry after
returning. Both pass with the fix, along with all 15 landing-prefetch unit tests.
Independent read-only review also checked upgrade and BFCache interactions and
reported no actionable findings.

The browser assertion now reports the actual list of missing URLs rather than
only their count. Its existing 120-second deadline is unchanged.

## Verification

- Full unit coverage: 6,290 tests in 238 files pass; 89.56% lines and 83.08%
  branches. All repository coverage gates pass.
- A fresh production Docker image passes all four landing-prefetch Chromium
  cases, including all editor engines cached, background core caching, actual
  font-catalog requests and an editor open served from the warmed worker cache.
- Archive integrity, repository-wide formatting, oxlint, refreshed workspace
  declarations and application TypeScript checks pass.

```sh
pnpm run test:coverage --maxWorkers=2
pnpm run format:check
pnpm run lint:ts
docker build -t document:pr279-ci .
docker run -d --rm --name document-pr279-ci -p 127.0.0.1:4199:80 document:pr279-ci
E2E_BASE_URL=http://127.0.0.1:4199 E2E_PORT=4199 pnpm exec playwright test \
  test/e2e/landing-prefetch.spec.ts --workers=1 --reporter=line
docker stop document-pr279-ci
```
