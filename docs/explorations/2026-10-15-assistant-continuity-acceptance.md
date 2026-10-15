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
| Exact `Hello` model requests              | 2 (classification + answer) | Pending acceptance    |
| Ordinary generic chat model requests      | 2                           | Pending acceptance    |

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

## Long conversation behavior

The existing runtime trims older complete turns to fit a request budget; it does
not summarize them. WebLLM's ordinary-chat fallback uses a 6,144-byte message
budget. A ready CPU provider with exact token counting budgets its complete
templated request and reserves output tokens. Stored history remains intact.
Semantic summaries are not part of this change: generating one on the Send path
would add a model call and requires a separate grounding/invalidation design.
