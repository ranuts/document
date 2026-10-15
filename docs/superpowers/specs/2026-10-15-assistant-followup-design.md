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
remain editor-bound. Capture immutable ComposerContext when enqueuing, including spreadsheet values: execution must not attach a newly selected source. Queued work must not silently recapture a different target.

Native transports do not need an added JSON classification request. Only an original unselected, untruncated, non-PDF candidate without host-read/proposal/refinement may defer editor freshness during pre-tool inference. Its request context is explicitly undefined (no fallback metadata); preflight deferral is opt-in/default strict and cannot enable PDF deferral. Every actual read/write still validates the original target in the registry. The first onTargetChanged callback, including a write promotion before review, permanently binds subsequent output to the editor. A missing target exposes no tools; stale-tool refusal ends in failure, never fallback chat or silent rebind. Owner guards remain active throughout.

Allow microphone dictation of the next draft while inference is running. It uses
the existing recognition lifecycle and explicit Send, which finalizes dictation
before queuing. It does not start another model request. Conversation changes,
deletion, assistant disable/close and disposal terminate recognition as before.

## Search

Normalize whitespace and case consistently on both sides, across segment
boundaries. The history-list query identity and search engine must use the same canonical query, so normalized results are not rejected as stale. Compile KMP query data once per query, reuse it across records in
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
is windowed. getLastAnswer/getLastDocumentBody must still find an eligible answer outside the rendered window. Bound previews of a giant restored message (for example 8000 characters) with explicit expansion; keep the full source for copy/apply. Ordinary append and live streaming retain their existing behavior. Existing appendMany behavior remains unchanged for other consumers.
Use the existing component/theme system; no new dependency or decorative motion. When the preparation footer shrinks an empty chat, do not auto-scroll its welcome content to the bottom: keep the heading visible while preserving normal following once messages arrive. A Chromium probe at 720px height showed titleTop=30 above messageTop=56 with scrollTop=70; this is a measured layout defect.

## Streaming Markdown reference update

The user additionally requested Streamdown as a rendering reference and paged
long history. Official [memoization documentation](https://streamdown.ai/docs/memoization)
and [unterminated parsing documentation](https://streamdown.ai/docs/termination),
plus its [block parser](https://github.com/vercel/streamdown/blob/main/packages/streamdown/lib/parse-blocks.tsx),
show stable block reuse, conservative tail reparsing and safe provisional syntax.
The current host instead appends plain text during streaming and formats the
whole response only on completion. This is a separate presentation improvement,
not a claim of faster model inference.

Add an opt-in streaming Markdown mode to shared ChatView and enable it in the
assistant host. Reuse the existing Marked lexer and safe DOM renderer, without
React, another Markdown stack, remote image loading or a new dependency. Keep
completed blocks and their DOM identities while reparsing only an unstable tail
at a bounded cadence; coalesce model deltas to frames and do not delay the first
text behind a debounce. Do not assume one blank line alone makes a paragraph,
list or setext heading immutable. Reference definitions can change earlier inline
meaning: preserve whole-document semantics on that fallback and final completion.
Use per-stream ownership rather than global mutable caches.

The evolving tail may render an open fenced code block with existing lexer
semantics. Incomplete inline syntax stays readable and incomplete/unsafe URLs
remain inert until a valid permitted link exists; do not invent source text or
add a homegrown general Markdown repair parser. Final Markdown must agree with
the existing full renderer for bounded input, including tables, nested lists,
reference links, CRLF and escaped syntax. Full original source remains the
copy/apply payload.

Every automatic main-thread lex/render must receive a capped input (for example
8000 characters), including tail updates, reference-definition fallback, normal
completion and interrupted formatting. A timer/rAF/idle deadline cannot preempt
one synchronous Lexer.lex call and must not be described as doing so. For a
pathological oversized open block keep incoming exact raw text readable in that
tail and preserve already stable formatted blocks. If reference semantics require
a whole-document fallback beyond the cap, retain the whole exact response as raw
text rather than silently render incorrect links. Completion keeps that bounded
mixed/raw representation; do not schedule a later uncapped whole-response parse.
Raw copy/apply remains complete. This explicit large-input fallback avoids adding
a Worker tokenizer and a second asynchronous DOM renderer in this change. The
cap bounds input size, not a promised number of milliseconds on every device.

Stop must still acknowledge without any synchronous Markdown parse, freeze exact
partial source as copy-only and reject late deltas. Clear/switch/dispose cancel
scheduled old formatting. Keep the viewport, text selection and existing
completed nodes stable wherever content has not changed; respect reduced motion
without adding token animations. Compare output across arbitrary chunk boundaries
for ordinary inputs; parser/render failures fall back to accurate safe raw text
without losing the source or enabling an incomplete link.

## DeepSeek Harness scroll ownership follow-up

The user requested another source comparison covering scrolling, rendering,
lists and reply interaction. Its [scroll-follow controller](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-chat/src/client/chat/use-scroll-follow.ts)
keeps native animation targets separate from reader intent. Its [conversation contract](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/conversation.md)
also preserves keyed nodes during older-page prepends and batches high-frequency
view publication without dropping logical updates. These principles support the
bounded history and streaming work already specified; no Cordis/React/server or
persistence architecture migration is required.

A Chromium probe of this branch confirmed a separate smooth-jump defect: after
return-to-bottom starts, its first native scroll event sets following=false.
Appending 100 new lines then leaves the final offset at the former floor 14732
while the current floor is 17136. New content is stranded 2404 pixels below the
reader even though the user explicitly requested bottom following.

Track an outstanding native follow target independently from the current offset.
Animation delivery alone must not detach the reader. Content/viewport growth
retargets an active smooth jump with native smooth scrolling, rather than
snapping immediately or stopping at the old floor. Settle ownership on this
scrollport's own scrollend plus verified arrival at the current target/floor, or
a measured bottom arrival without scrollend. An old animation may emit scrollend
after growth retargeted it: if still above the current floor, retain intent and
retarget instead of clearing ownership. Do not use guessed animation timeouts or
an endless polling loop. Reduced motion remains immediate. Explicit reader
scrolling gestures interrupt an outstanding native target and the actual native
animation (freeze its current offset), keeping the reader in control. Old progress
or scrollend events must not reattach canceled ownership, and subsequent layout/
resize work must not revive it. Nested
scrollend events must not settle the outer transcript. Preserve existing normal
follow thresholds, empty-welcome behavior and paged reading anchors.

Keep this change local to ChatView or a small framework-free scroll-follow helper.
Clear/dispose reset outstanding motion ownership and scheduled callbacks. Test
smooth jump plus streaming growth, reader interruption before a resize, completion
with and without scrollend support, nested scrollend isolation, reduced motion,
clear/dispose and the prior paged/empty-message geometry. Avoid copying the
reference project's broader folding/navigation architecture.

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
