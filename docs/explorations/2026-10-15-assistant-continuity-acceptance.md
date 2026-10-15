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

Final functional, visual and exact-head CI results will be recorded after the
implementation and reviews finish.

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
large-selection byte-budget boundary; its follow-up and final integration
acceptance remain pending.
