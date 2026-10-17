# Document lifecycle follow-ups

Baseline: `6b7fbdfd`. The user explicitly approved all five demonstrated defects
and both optimizations from the post-PR-279 audit, regression tests, separate
commits, a new PR and following its latest CI head until every check passes.

## Scope lock and evidence

| Task                          | Verified baseline evidence                                                                                                    | Change boundary                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Expired active document       | Real store/database with fake IndexedDB returns successful metadata but no latest bytes after seven days.                     | `lib/history/store.ts`, history store/browser regressions.                                  |
| Independent document identity | Real session/autosave/disk routing returns unavailable with an authorized target after autosave is disabled.                  | `lib/history/{session,index,autosave}.ts`, document/close callers as needed, related tests. |
| Pending lock cancellation     | Delayed Web Locks callback recreates a stopped autosave session.                                                              | `lib/history/autosave.ts`, scheduler regressions.                                           |
| Anthropic lifetime/errors     | Actual SDK with a short timeout stays pending after headers; real SDK timeout/overload errors miss UI classification.         | Anthropic provider/factory options and request error normalization, focused tests.          |
| Local open error ownership    | Actual entry/tool code reports success and applies readonly after injected conversion failure.                                | `lib/{document,web-mcp}.ts`, entry/recovery callers and tests.                              |
| Original Blob URLs            | Actual entry source opens three files; all abandoned URLs remain readable after creating a blank document.                    | `lib/{document,embed-api,events}.ts`, URL lifetime tests.                                   |
| Runtime cache reuse           | Worker install requests an identical asset held by an owned previous core and fails when its redundant network request fails. | `public/sw.js`, worker/offline regressions.                                                 |

Use existing modules and explicit lifecycle ownership. Keep identity independent
of the recovery timer, invalidate pending asynchronous starts, and reuse only
exact same-origin build-owned URLs from owned caches. Preserve complete runtime
preparation before activation. Remove redundant original-file URL allocation;
the actual editor document URL retains its existing owner.

No schema migration, new dependency, vendored/runtime edits, immutable archive
changes, model-default changes, arbitrary cache discovery or new data destination.
Keep user cancellation reasons, save target consent, retry ordering, offline
availability and document mutation approval intact. Add an Anthropic-owned total
deadline covering SDK consumption; do not rely on the SDK header-only timeout.

## Execution and verification

1. Add failing behavioral regressions before implementation in each owned scope.
2. Implement history, Anthropic and offline work independently; parent owns local
   open/URL callers, integration, documentation, Git and PR operations.
3. Review each scope against all consumers, then review the complete branch.
4. Run full unit coverage, repository formatting/lint/types, production build and
   targeted real Chromium regressions. Preserve existing test deadlines.
5. Commit by topic, push normally, create a new English PR and attach it to the
   task. Preserve multiple commits; no squash or force-push. Follow only the
   newest PR head until all shards and required summaries succeed. Do not merge.

Ruling: reuse this clean checkout on a dedicated `codex/` branch. Existing
unrelated worktrees are untouched. The user's explicit implementation request
approves the seven concrete audit outcomes; no additional approval stage is
needed for routine implementation choices within these boundaries.

## Implementation evidence

- Snapshot expiry excludes the document whose fresh bytes are being written.
  Its new bytes, revision counters and authorized target survive while other
  expired rows still retire atomically. The regression failed before the fix.
- Active document identity now outlives the recovery scheduler. Recovery-only
  stops keep it; actual close/replacement clears it. Disk routing and saved
  metadata use the active identity without trusting a URL. Real repository and
  file-target tests cover disabled-before/after-open and storage-stop behavior.
- A generation invalidates every pending recovery start, including stops before
  a session exists. Late lock grants release before timers/listeners or writes.
  Both A/B completion orders, disable and explicit close have regressions.
- Anthropic owns a configurable five-minute deadline across SDK request/body
  consumption. Controlled cancellation, callback failures and reentrant Stop
  settle promptly and clean up timers/listeners/streams. Tests exercise actual
  SDK stalled JSON/SSE responses and actual timeout/overload error classes.
- Local opens reject failures and obsolete completions. Picker/bootstrap callers
  consume already-reported errors; tool/recovery callers receive the rejection.
  Buffer read-only mode travels with the owned open rather than a later global
  mutation. Cross-entry replacement and failed-source preservation remain tested.
- Standalone, embedded and desktop opens retain the File without allocating an
  unused second original-file URL. The actual editor URL keeps its existing
  allocation/revocation owner. A tracked URL registry exposed seven baseline
  entry/outcome failures before the fix; all eight new entry cases now pass.
- Runtime preparation copies exact successful same-origin allowlisted responses
  from earlier owned core caches before fetching misses. Sixteen regressions
  cover headers/bytes, changed hashes, failures, unrelated caches, concurrency
  and complete-before-activation. The original avoidable install failure now
  succeeds without requesting the already-held runtime again.

Four independent scoped reviews reported no actionable findings. The full unit
coverage run passes **6,349 tests in 243 files**, with 89.67% lines and 83.19%
branches; every repository coverage gate passes.

Both new real-editor browser regressions failed against the exact baseline
production Docker image: the expired document's new revision was absent, and
two ordinary saves with recovery disabled opened two pickers. These are actual
IndexedDB/editor/file-system flows, with prior timestamps and a genuine OPFS
handle used as controlled fixtures.

## Assembled verification

- All **33 Chromium cases pass** against a fresh production Docker image in
  2.6 minutes, including both new regressions, source entry paths, queue/Stop,
  service errors/streaming, offline capability upgrades, actual recovery,
  authorized disk writes, save ordering, PDF export and reload target reuse.
- Repository formatting, archive integrity (1,511 immutable artifacts), oxlint,
  refreshed workspace declarations and application TypeScript checks pass.
- Production Docker build passes; existing bundler size warnings remain.
- Independent complete-branch review approves all seven changes and their
  consumers, with no unresolved actionable findings.

```sh
pnpm run test:coverage --maxWorkers=2
pnpm run lint:ts
pnpm run format:check
docker build -t document:lifecycle-followups .
docker run -d --rm --name document-followups-preview -p 127.0.0.1:4202:80 document:lifecycle-followups
E2E_BASE_URL=http://127.0.0.1:4202 E2E_PORT=4202 pnpm exec playwright test \
  test/e2e/history-quota.spec.ts test/e2e/save-to-file.spec.ts \
  test/e2e/entry-paths.spec.ts test/e2e/autosave-recovery.spec.ts \
  test/e2e/agent-error-recovery.spec.ts test/e2e/agent-request-queue.spec.ts \
  test/e2e/assistant-offline-assets.spec.ts test/e2e/agent-cloud-streaming.spec.ts \
  test/e2e/landing-prefetch.spec.ts --workers=1 --reporter=line
docker stop document-followups-preview
```

These checks use deterministic failure/storage/lock fixtures and actual
Chromium/IndexedDB/OPFS/worker/editor behavior. They do not certify live provider
accounts, physical disk exhaustion or every browser/runtime inference backend.
