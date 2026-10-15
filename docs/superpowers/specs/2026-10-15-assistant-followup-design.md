# Assistant follow-up design

## Goal and authorization

Continue PR #271 with the fixes and optimizations accepted by the user after the
fresh overall review. Preserve functional commits and follow the final commit
through all CI checks. Do not merge or create another PR.

## Evidence and scope lock

| Assumption                                             | Evidence                                                                            | Status                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------- |
| Initial restore can orphan an unaccepted first request | Chromium real Word probe and controlled delayed repository test at 62c614c          | Runtime fact                             |
| Preparing queue actions are enabled but rejected       | Chromium held classifier; Remove unchanged, Edit reports occupied empty draft       | Runtime fact                             |
| Hello fails when the editor changes during its answer  | Chromium held answer + SDK input produced proposal-expired                          | Runtime fact                             |
| Search whitespace differs between corpus and query     | Chromium Worker/fallback: double-space query 0, single-space query 1                | Runtime fact                             |
| Long history is synchronously rendered                 | chat-view.ts appendMany; 1000-message probe: 19023 nodes, 135ms pending timer delay | Runtime fact                             |
| CPU budgeting recounts one-turn-shorter histories      | context-budget.ts; synthetic 1000-turn probe: 998 callbacks                         | Source/count fact, not tokenizer latency |
| Speech refuses to begin during inference               | panel.ts allowed callback and speech-input.ts begin                                 | Code fact                                |
| Real local GPU first-visible-text latency is unknown   | Prior acceptance explicitly excludes it                                             | Known measurement limit                  |

Allowed: assistant UI/session/search/queue/controller modules, shared ChatView,
agent-core context budget and local provider timing, corresponding unit/E2E tests,
seven locale tables, assistant styles and focused docs/changelog.
Untouched: vendor/evaluation archives, dependencies, storage schema, authentication,
public document bridges, site marketing and model defaults. No semantic summaries,
new inference engine, server, analytics upload or prompt-content logging.

Compatibility red lines: pending requests/drafts remain volatile, disk history is
opt-in, exact user text survives recovery, writes and grounded editor reads retain
original scope checks, actual Apply settlement blocks further inference, Stop does
not auto-resume old work, obsolete callbacks cannot affect another request, and
legacy ChatView hosts keep their defaults.

## Queue ownership and preparation

Retain the original in-memory session while it owns an unaccepted or pending
request. Initial storage hydration must merge saved records without removing or
reloading that live owner. Do not rebind its target to a saved conversation or
persist queued text as a fabricated user message. Explicit deletion/import and
manual restore continue to invalidate requests before replacing owners.

Expose preparing identity in queue presentation. While an active entry is being
validated, show a localized preparation state and disable actions the queue cannot
perform. Stop stays available. After cancellation physically settles, recovery
can edit the original text. Distinguish occupied input from other refusal causes;
do not leave stale feedback after a successful action or conversation change.

## Conversation and voice continuity

Separate a proven conversation-only request from an editor-bound read/write.
Greetings and ordinary chat without a selected reference must keep working while
the user edits the document. Such requests omit selected text and do not require
unchanged cursor/history. Provider, conversation, enablement and cancellation
ownership remain mandatory. Classification alone cannot authorize writes: every
write/read action still validates its original target after routing and before
execution. PDF page answers, selected-source answers, host reads and proposals
remain editor-bound. Queued work must not silently recapture a different target.

Allow microphone dictation of the next draft while inference is running. It uses
the existing recognition lifecycle and explicit Send, which finalizes dictation
before queuing. It does not start another model request. Conversation changes,
deletion, assistant disable/close and disposal terminate recognition as before.

## Search

Normalize whitespace and case consistently on both sides, across segment
boundaries. Compile KMP query data once per query, reuse it across records in
Worker and fallback, and check fallback deadlines within the record loop.
Preserve segmented transfers and cancellation identities; do not add an arbitrary
short search-length limit or silently trim user search text.

## Long conversation rendering

Restore the latest bounded window first (at most 40 messages, including for a single oversized turn). Provide one localized, keyboard-accessible control
to load earlier messages in batches. Preserve existing rendered nodes, current
viewport anchor, next draft, copy actions and any live stream while prepending.
Prepending must preserve lastUserText and each Restore request source. If a window starts inside an assistant/tool segment, derive its preceding user request without rendering the entire turn. Loading old rows must not change the recovery source of a later error.
Switch/clear/dispose cancels the old window owner. Full history remains in the
session/controller and available for model budgeting/export; only presentation
is windowed. Existing appendMany behavior remains unchanged for other consumers.
Use the existing component/theme system; no new dependency or decorative motion.

## CPU context budget

Replace repeated one-turn removal/counting with bounded coarse bracketing and
refinement over complete turn starts. Return only an exactly counted fitting
candidate, preserving the latest complete user/tool exchange and reserved output
budget. Check the latest complete turn before reporting overflow. Do not assume token counts are monotonic or promise a globally maximal retained suffix; retain the best measured fitting candidate. Reject an oversized latest turn only after that exact check; check abort between awaited counts.
The CPU caller must rebuild its actual completion request from returned budget.messages; a counting callback must not leave a rejected probe as the request. Do not rely on strict tokenizer monotonicity to establish safety or promise an absolutely maximal suffix.
Never claim token counts are byte estimates. Preserve API/defaults and runtime
error validation. A thousand-turn fixture should take O(log n) count calls rather
than nearly one thousand; realistic tokenizer timing remains separately measured.

## Request timing

Measure, do not infer: routing duration, context preparation/budget duration,
first nonempty model delta, first filtered output and first presented DOM text. Provider timings use a
monotonic clock; first model text can differ from visible output after reasoning
or schema filtering. Missing stages stay absent, never fabricated as zero.
Sample first presented text from an optional request-owned ChatView hook at the actual nonempty DOM flush, not from appendDelta (which only buffers). Report it only while the connected panel and document are visible; this is DOM presentation timing, not proof of compositor paint. Clearing/stopping/switching must invalidate pending presentation callbacks.
Record only bounded, local numeric timing/status data through existing usage
metadata and a small request-timing owner; no content, credentials, persistence,
external telemetry or busy product diagnostics panel. Each record belongs to one
request and cannot leak through stopped/superseded callbacks. Ordinary chat is the
initial complete measurement path; other paths report only stages they actually
observe. Preserve existing actual-phase waiting feedback.

## Alternatives

Blocking Send until all history restores is simpler but delays ready local work;
retain the live owner instead. Hiding failed queue buttons is less clear than
showing preparation with truthful disabled state. Rebuilding all visible history
on every prepend loses action/scroll ownership; prepend bounded nodes instead.
A new virtualization library or inference Worker duplicates existing mechanisms;
use explicit history windows and the existing local-model Worker. Generating
summaries on Send adds inference and invalidation risk; keep exact turn trimming.

## Acceptance

RED/GREEN unit regressions for each reported defect and new contract; real Word
browser probes for delayed hydration + first Send, ordinary chat + concurrent
editing, preparation buttons and speech + queued draft. Worker/fallback whitespace
and long-query checks; long-message restoration counts, older-message accessibility
and viewport anchoring; 1000-turn exact-budget call count, boundary and abort tests;
controlled-clock stage timings and stop/supersession isolation. Finish with full
unit tests, canonical lint/type/format, production build, serialized related editor
regressions, responsive English/Chinese light/dark inspection, final review, and
all exact-head CI checks including regular/Docker/Cloudflare E2E and preview smoke.
