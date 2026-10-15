# Assistant continuity acceptance

This extends PR #271. Voice repair remains in commit `91ad1dd`; history,
cancellation, follow-ups and request-context changes are reviewed separately.

## Baseline

Measured with Chromium 151.0.7922.34 against a local production build. The history
fixture contains 1,000 conversations, eight messages per conversation and 512
characters per message. It contains synthetic text only.

| Observation                               | Before                      | After                 |
| ----------------------------------------- | --------------------------- | --------------------- |
| Initial conversation rows                 | 1,000                       | 40                    |
| Message-array clones per full-text search | 1,000                       | 0                     |
| Synchronous input handler, three queries  | 15.2 / 43.8 / 18.6 ms       | 0.19 / 0.12 / 0.10 ms |
| Exact `Hello` model requests              | 2 (classification + answer) | 1 (answer)            |
| Ordinary generic chat model requests      | 2                           | 2                     |

The request baseline uses a synthetic loopback endpoint and an empty Word
document. Both exact greeting and ordinary chat include document-body context in
their answer request. The greeting requests contain 2,183 and 2,780 serialized
characters; these are request sizes, not token counts. Browser-local GPU time to
first token has not been measured.

The final history probe resolved its cold query in 227 ms and indexed queries
in 3.5 / 31.5 ms. Indexed queries posted no corpus updates. An intermediate
version required 2,982 ms for cold indexing because each small batch used a new
clamped timer. Amortizing bounded transfers within 4ms task slices removed that
delay. These are single-machine observations, not cross-device timing promises.

## Delivery checks

The voice-only head `91ad1dd` passed all reported GitHub checks, including three
E2E variants, timing budgets, lint, preview smoke and Cloudflare deployment.
That result does not validate subsequent continuity changes.

Final delivery status and exact-head CI results are tracked in
[PR #271](https://github.com/ranuts/document/pull/271). Earlier checkpoint results
below distinguish their source revisions from the final local source checkpoint.

## Integrated queue checkpoint

At `2e5f59e`, all 5,622 unit tests in 193 files passed. Repository lint,
workspace/application type checks, formatting and the production build passed;
both quality entry points verified all 1,511 immutable evaluation artifacts.
The serialized real-editor run passed 41 cases and skipped three unavailable
legacy corpus formats. Two queue cases exposed browser focus loss when Send
disabled itself; `a73e075` captures focus ownership before clearing the draft.
The next browser run passed that focus assertion and exposed a fixture using
NDJSON against the loopback provider's non-streaming JSON contract. Both Word
and PowerPoint FIFO/Stop/Resume/Send now cases passed after the fixture transport
repair at `b10c9e4`. The Apply settlement follow-up remains in progress.

At `a73e075`, selected-text disclosure checks passed in 12 English/Chinese,
320/432/520-pixel, light/dark states. Heading, preview and input left coordinates
matched exactly; panel horizontal overflow was zero. Chromium observed
intermediate heights while both opening and closing, then returned to the same
expanded height after reversing the animation. Enter/Space and reduced motion
passed. Three real-editor context-event tests passed, including no idle SDK reads.
The shared disclosure/queue/Stop focused suites passed all 12 tests.

A separate reduced-motion Chromium component probe exercised the independent
queue Stop button with a 108,000-character partial answer. The synchronous
handler took 1.07 ms; stopping feedback appeared on the next frame at 9.37 ms.
No Markdown parsing occurred before that frame. Raw source, next draft and caret
were preserved; three cancellation attempts invoked the host once. This is a
component measurement with held host settlement, not physical GPU drain timing.

The pending-list layout also passed 12 English/Chinese, light/dark width states
at `a73e075`. Two pending entries and the independent Stop button stayed visible,
input focus stayed in the next draft, and horizontal overflow was zero. Stop
preserved the unsent draft and exposed Resume without auto-running older work.

## History checks

Source review approved bounded segmented extraction/transfers and resumable
BFCache cleanup. The root checkout passed 107 focused tests across six files
after the scheduling and progress follow-up. Both real-editor history E2E cases
passed against that production build, including 1,000-conversation full-text
search with no repeated message clones or corpus posts.

The history presentation was inspected in 12 states: English/Chinese,
320/432/520-pixel panels, light/dark, with reduced motion enabled. All measured
panel overflow was zero. Keyboard navigation from search to a conversation and
Escape back to the preserved draft passed. These screenshots do not measure
model inference or establish a complete accessibility audit.

## Stop checkpoint

At head `30040bc`, all 5,504 unit tests in 189 files passed. Fifteen real-editor
E2E cases passed serially: Word/Excel/PowerPoint/PDF composer and dictation,
first microphone permission, actual phase feedback, and Word/PowerPoint
Stop-during-routing/answer followed by two new questions without reloading.

A separate Chromium 151.0.7922.34 probe mounted the shared ChatView with a
synthetic 108,000-character partial answer and held host settlement. Stop took
1.35 ms synchronously; the next animation frame at 11.08 ms showed stopping,
disabled repeat cancellation, unchanged raw source and the focused next draft
with its selection preserved. Markdown had not been parsed before that frame.
Three cancellation attempts invoked the host once. Reduced motion was enabled.
This measures component interaction, not physical GPU cancellation/drain time.

Source and quality review approved per-run ownership and capability-derived
document outcomes. Cancelled, unverified, expired and unavailable native tool
receipts cannot masquerade as successful queue advancement.

## Long conversation behavior

The existing runtime trims older complete turns to fit a request budget; it does
not summarize them. WebLLM's ordinary-chat fallback uses a 6,144-byte message
budget. A ready CPU provider with exact token counting budgets its complete
templated request and reserves output tokens. Stored history remains intact.
Semantic summaries are not part of this change: generating one on the Send path
would add a model call and requires a separate grounding/invalidation design.

## Request performance checkpoint

At head `44fe2aa`, a production build and a separate Chromium 151.0.7922.34
loopback probe passed. Each scenario used a fresh conversation and the same
synthetic one-paragraph Word document. These are request counts and source-read
observations; the responses do not measure browser-local GPU latency.

| Scenario                       | Classification | Answer | Whole-body walks | Answer request characters |
| ------------------------------ | -------------- | ------ | ---------------- | ------------------------- |
| Exact `Hello`                  | 0              | 1      | 0                | 272                       |
| Ordinary programming joke      | 1              | 1      | 0                | 300                       |
| Host-staged Explore document   | 0              | 1      | 1                | 430                       |
| Staged read edited into a joke | 1              | 1      | 0                | 300                       |

The trusted read included the actual synthetic source and document-body scope;
all four answer requests contained zero tools. Editing the staged request
removed its trusted routing. Unlike the earlier empty-document baseline, this
fixture contains text, so serialized sizes are observations of each request,
not a controlled percentage improvement claim. Ordinary ambiguous chat keeps
semantic classification intentionally. Source review identified the separate
large-selection byte-budget boundary. Its shared serializer follow-up passed
specification and quality review and 37 independently run boundary tests;
instruction text and public source windows remain unchanged.

At `7908c4e`, the production build and all 18 serialized real-editor workspace,
write-tool and process-feedback regressions passed, including Word, spreadsheet
and slide writes, review, refinement and cancellation. The full unit checkpoint
passed 5,557 tests and exposed four failures in the older write-reply fixture,
which mocked strong capture but omitted the newly required lightweight scope.
The repaired fixture then passed all seven cases at `3457bd0`, preserving the
write, cancellation and conversation-ownership assertions. Repository lint,
workspace/application type checks and formatting passed; both quality entry
points verified all 1,511 immutable evaluation artifacts. Queue integration
was subsequently validated at the checkpoints above.

## Final local source checkpoint

At `6e4b8b4`, all 5,661 unit tests in 194 files passed. The production build,
workspace/application type checks and formatting passed. Full lint passed at
the Apply checkpoint; the subsequent header change also passed focused lint
and the complete workspace/application type check. All 1,511 immutable
evaluation artifacts were verified unchanged.

Specification and code-quality review approved the complete source, including
physical Apply settlement, retained native verified receipts, asynchronous Send
focus, selection disclosure and conversation-title navigation. Twenty-two
serialized real-editor write/workspace/queue/Stop cases passed at the Apply
checkpoint. The final combined editor run and exact-head CI are reported in
the PR rather than inferred from those earlier runs.

A separate Chromium check passed both saved-history and empty-history title
entry. It verified latest meaningful chat selection, per-chat draft ownership,
draft-only history access, keyboard entry and preservation of a live answer.
Another Chromium check confirmed that asynchronous Send preparation restores
input focus after native disabled-button blur while respecting deliberate focus
on another control. Neither probe uses a real microphone or measures GPU latency.

## Fresh-review continuity checkpoint

The follow-up design records defects reproduced at `62c614c` rather than treating
its green CI as proof of complete interaction correctness. At `ef01e2b`, 300
focused unit tests and three real-editor history cases passed. A separate
Chromium delayed-IndexedDB/held-classification probe verified that the original
first-request owner stays reachable, preparing actions are disabled truthfully,
the next draft survives hydration and the answer completes. Twelve preparation
states (English/Chinese, 320/432/520 pixels, light/dark) had zero horizontal
overflow. The narrow empty welcome was found to auto-scroll above its viewport;
that separate defect is included in the bounded-rendering follow-up.

At `fcb36f0`, the production build and 295 independently run focused unit tests
passed. Seven serialized real-editor dictation/queue cases passed, including
first permission and Word/Excel/PowerPoint/PDF dictation. The Word queue case
edits and selects document text while an ordinary answer is held. Separate
Chromium greeting/routed-chat probes completed their answers and queued greeting
after an SDK edit. The controlled recognition probe dictated during a held
answer, finalized once on explicit Send and waited for physical request
settlement before the next model call. These probes do not use a physical
microphone or establish real local-model inference latency.

Specification and independent quality review approved both follow-up chunks.
Search, exact budgeting, bounded message restoration and local request timing
are subsequent checkpoints; these results do not claim to validate them.

At `7c45f66`, 79 independently run search/budget/provider unit tests passed.
Chromium Worker and fallback searches each matched copied double spaces,
newline/tab whitespace and a word sequence split across corpus segments. The
same synthetic 1,000-turn exact-budget counter now made 21 callbacks and visited
20,956 message entries, compared with 998 callbacks and 1,000,994 entries before.
It retained six messages with 3,072 measured prompt tokens plus 1,024 reserved
output tokens in the fixture's 4,096 capacity. These are synthetic callback/work
counts, not real tokenizer or GPU timings. Wllama integration separately checks
that generation receives the counted fitting suffix instead of the last rejected
refinement probe. Specification and independent quality reviews approved it.

At `99f7b03`, the production build and 309 independently run focused tests passed.
All three serialized real-editor history cases passed, preserving the original
400-message content/actions after explicit pagination, the 1,000-conversation
search checks and delayed-startup ownership. A same-source Chromium component
probe mounted 40 rows / 784 DOM nodes from 1,000 messages and later reached every
original row. The warmed 1,000-message sample took 4.86ms to restore with a 6.12ms
pending-timer delay; the cold first 50-message sample took 21.21ms/23.26ms. The
baseline 1,000-message eager render used 19,023 nodes and a 135ms timer delay.
These single-machine samples are observations rather than latency guarantees.
Ordinary page anchoring drifted at most 0.33 pixels. An expanded cross-window
70-tool group drifted 0.39 pixels while preserving its group/open summary, all
ordered receipts, live reply, draft and focused input. The source-level answer
and document-body getters also succeeded when those messages were outside the
rendered window.

Twelve English/Chinese preparing states at 320/432/520 pixels in light/dark now
keep scrollTop=0 and titleTop=100 below messageTop=56, with zero horizontal
overflow. The delayed-startup request/draft assertions also pass in both locales.
English 320px dark and Chinese 432px light screenshots were inspected. The
separate [reference review](2026-10-15-assistant-harness-review.md) records a newly
reproduced native smooth-scroll target failure; that follow-up is still pending.

## Streaming Markdown checkpoint

Specification and independent quality review approved `27836c7` and the small
caret correction `7b2bd7c`. The root checkout passed 91 focused ChatView tests.
A Chromium 151.0.7922.34 development-build probe verified progressive open-fence
rendering, stable completed nodes and text selection, inert incomplete URLs and
safe activation after closure. Identical formatted content had zero bubble-height
change on completion. The initial browser run exposed a 23.796875-pixel extra
caret line; the correction excludes only formatted streams, preserving the legacy
plain-stream caret and the existing actual responding status.

A synthetic 108,000-character open tail stayed readable as exact raw text without
passing it to the lexer. Stop invoked no synchronous lexer calls and preserved
the complete interrupted source, copy-only result, next draft, focus and selection;
late deltas were ignored. This component probe observed a 0.315ms synchronous Stop
handler. It measures local presentation work, not model inference or GPU drain.
All automatic opt-in formatting inputs are capped at 8,000 characters; unusually
large reference-dependent responses deliberately remain raw at completion. The
focused unit cases exercise the cap at completion, interruption and fallback.
