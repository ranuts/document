# Recovery and provider request safety

Baseline: `ac2dcade`. Scope: failed quota retries, fetch-provider deadlines and
Gemini service-error guidance. No storage schema, retention budget, model default,
provider destination, inference runtime or document-write behavior changes.

## Recovery quota retry

Previously, the first quota failure caused an independent transaction to delete
the coldest recovery document before retrying the new snapshot. If the retry
also failed, the old recovery was already gone and the new snapshot was absent.

The retry now owns both eviction and replacement in one transaction across
metadata, snapshot bytes and disk handles. Cancellation or any second write
failure aborts that transaction. Commit-only save-target cleanup therefore runs
only after a successful replacement. There is still at most one retry, and the
current document remains protected from eviction. Successful quota recovery and
ordinary retention keep their existing behavior. A browser that cannot reclaim
space within the transaction may still refuse the write; it must retain the
previous recovery instead of trading it for a failed snapshot.

Unit regressions inject both a repeated quota failure and a different error on
retry, then check metadata and bytes for the old and current documents. A browser
regression edits a real document, triggers its departure snapshot and injects
two quota errors in real IndexedDB. It checks that the old document remains in
the history page with byte-for-byte identical recovery content.

## AI HTTP request lifetime

OpenAI-compatible, Gemini and Ollama adapters share a small HTTP boundary.
The default total deadline is five minutes, matching the existing Loopback
duration; constructor/factory callers may override `timeoutMs`. One timer covers
headers and body consumption. Cancellation forwards the original caller reason;
deadline expiry produces `TimeoutError`. The boundary races transport/body work
with cancellation so a non-cooperative injected transport cannot retain the
controller indefinitely. The boundary owns the response stream reader and
cancels it directly on timeout or Stop, then releases the reader lock. Late
responses are rejected and their unused bodies cancelled. Settlement removes
timers and caller listeners.

Ollama also accepts the existing neutral provider cancellation argument. The
Anthropic SDK, Loopback and browser inference adapters are unchanged.

HTTP errors carry `status` and only a safe provider/status message. Error bodies
are cancelled without reading them, avoiding stalled error streams and private
upstream details. The UI recognizes Gemini as well as existing provider messages
when a boundary serializes the error to text. Existing localized guidance is
reused. A timeout is a failure rather than a user-requested Stop, and no implicit
resend occurs. A fresh explicit request may run after the previous one settles.

## Verification

The initial history regressions failed against the baseline because the old
document was absent after the retry. The initial provider regressions failed
because requests remained pending or HTTP errors lacked structured status.
An assembled reverse run against the baseline reproduced 22 expected failing
regressions across history and provider handling.

Independent read-only review identified that native `response.json()` could
retain a locked body when a host transport ignored cancellation. Three real
stream regressions failed before replacing it with an owned reader, then passed.
The reviewer rechecked cleanup, including a stream whose cancellation promise
never settles, and confirmed equivalent UTF-8/BOM decoding across 59 split-chunk
probe cases. No actionable findings remain from that review.

The two new Chromium regressions also failed against an isolated build with
the baseline history and cloud-provider implementations: recovery metadata was
empty after quota failure, and Gemini displayed generic failure instead of
rate-limit guidance. Source files were not changed for this browser check.

Initial assembled verification:

- Full unit coverage: 6,223 tests in 233 files pass; 89.38% lines and 82.90%
  branches. All repository coverage gates pass.
- Ten Chromium cases pass: quota failure with original bytes retained, Gemini
  and existing service-error recovery, Word/PPT request queues and Stop, actual
  autosave/reopen/embedded isolation, Word editing/save and Excel create/save.
- Archive integrity, oxlint, workspace declaration builds and application
  TypeScript checks pass via `pnpm run lint:ts`.
- The production build passes. Existing large-chunk and ineffective dynamic
  import warnings remain outside this change.

Verification commands:

```sh
pnpm run test:coverage --maxWorkers=4
pnpm run lint:ts
pnpm run format:check
pnpm run build
E2E_BASE_URL=http://127.0.0.1:4197 E2E_PORT=4197 pnpm exec playwright test \
  test/e2e/history-quota.spec.ts test/e2e/agent-error-recovery.spec.ts \
  test/e2e/autosave-recovery.spec.ts test/e2e/main-site.spec.ts \
  test/e2e/agent-request-queue.spec.ts --workers=1 --reporter=line
```

The browser commands use the production build served by Vite preview. This pass
does not claim complete E2E, Firefox/WebKit, Docker, Cloudflare hosting or live
cloud-provider acceptance. Network failures and full storage are deterministic
fault injections; real account quotas and physical disk exhaustion are not
required or exercised.

## Follow-up: reject oversized exports before reading bytes

The snapshot store previously checked its byte budget after materializing a
Blob/File. Autosave also eagerly read the exported File before delegating to the
store. A known oversized export therefore still allocated another full buffer.

The store now checks the known input size before conversion, and autosave passes
the exported File directly with its existing cancellation signal. The later
actual-byte check remains. Three regressions first failed because `arrayBuffer`
was called once; the fix must reduce that count to zero for oversized Blob,
File and actual autosave inputs while retaining the previous recovery bytes.
This is an operation-count improvement, not a measured heap-size claim.

## Follow-up: omit unused tool-calling fields

OpenAI-compatible and Ollama requests previously included an empty `tools` array
and `tool_choice: auto` even for plain chat or writing without tools. They now
omit both fields when the registry is empty, following the existing Gemini
adapter's conditional tool declaration. Requests with tools keep the same tool
definitions and automatic selection. Two strict-endpoint regression fixtures
reject unused tool fields; both failed with HTTP 400 before the fix and return
their plain answer afterward. These fixtures validate the adapter contract and
do not claim a live vendor endpoint was tested.

## Final follow-up verification

Independent review of the two follow-ups found no actionable defects, including
the autosave cancellation/session boundary and requests with nonempty tools.

- Full unit coverage: 6,228 tests in 233 files pass; 89.40% lines and 82.91%
  branches. All repository coverage gates pass.
- The same ten Chromium cases pass on the final production build in 58.9 seconds.
- Archive integrity, lint, workspace declaration builds, application TypeScript
  and the production build pass. The existing bundler warnings are unchanged.
- All five added follow-up regressions were reverse-verified before the fixes:
  three oversized-input cases and two strict-compatible-endpoint cases.

The verification commands and coverage limits described above also apply to
this follow-up pass.
