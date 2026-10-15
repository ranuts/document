# Assistant interaction reference review

The user requested Streamdown and DeepSeek Harness as references while continuing
PR #271. This is a source comparison, not a claim that either project was run or
that its full architecture should be transplanted into this browser editor.

## Findings and decisions

| Area                        | Source evidence                                                                                                                                                                                                                                                                                                                                                                         | Decision for this editor                                                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scroll intent               | DeepSeek's [ScrollFollow](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-chat/src/client/chat/use-scroll-follow.ts) separates a native target, delivered offsets and reader ownership; its [Chat contract](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-chat/README.md#scroll-ownership) isolates nested scrollports. | Fix the reproduced smooth-jump/growth failure with a small owned controller. Preserve page anchors, gesture cancellation and reduced motion.                                                                  |
| Older history               | The [conversation contract](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/conversation.md) accepts older pages while retaining existing keyed nodes and replaying affected state.                                                                                                                                                                         | Restore the latest 40 messages, load older batches and preserve live nodes, review actions, request recovery and complete source history. No new storage/event protocol.                                      |
| High-frequency updates      | That same contract distinguishes ordered logical updates from animation-frame view publication; structural/terminal changes publish immediately.                                                                                                                                                                                                                                        | Keep every delta in source order, coalesce DOM work to frames and retain immediate Stop acknowledgement. Never debounce away the first reply or a terminal state.                                             |
| Markdown blocks             | Streamdown's [block parser](https://github.com/vercel/streamdown/blob/main/packages/streamdown/lib/parse-blocks.tsx) verifies stable offsets and retains a conservative tail. DeepSeek's [incremental parser](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/markdown/incremental.ts) similarly freezes stable blocks.                   | Add host-opted-in incremental Markdown with stable DOM identities, safe provisional links and exact source payloads, using the existing lexer/renderer.                                                       |
| Pathological Markdown       | DeepSeek's [MarkdownText](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/markdown/MarkdownText.tsx) documents a cross-boundary reference limitation and performs a full settled parse. Streamdown explicitly detects reference definitions before prefix reuse.                                                                          | Bound all automatic main-thread parsing. Normal bounded output matches the full renderer; oversized unresolved tails stay raw. Do not defer an uncapped full parse and call it bounded.                       |
| Expensive enrichment        | DeepSeek's [viewport highlighter](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/markdown/useViewportHighlighting.ts) activates code highlighting on first viewport intersection and releases its observer when empty.                                                                                                                   | Useful if syntax highlighting is added later. The current renderer has no expensive highlighter, so adding one to claim lazy-loading gains would increase scope and work.                                     |
| Queued replies              | The [input contract](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-conversation/README.md#input) keeps optimistic submissions separate, disables unavailable actions before admission and preserves a newer typed draft on failure.                                                                                                                    | This matches the new preparing state and volatile queue. Keep exact recovery text, one physical execution owner and editable next drafts, including dictation.                                                |
| Cancellation and settlement | The [agent lifecycle](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/agent-lifecycle.md) distinguishes transient chunks from settled messages/failed attempts, and freezes requests before streaming.                                                                                                                                                                 | Retain per-request identity, original-target guards, exact partial-source recovery and physical inference/Apply settlement. Do not add transcript logging or claim backend cancellation has already finished. |
| Context pressure            | [Compaction](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/compaction.md) is optional, with owned operations and validated replacement ranges.                                                                                                                                                                                                            | Keep exact complete-turn trimming now. Summary generation would add model work and needs its own grounding, cancellation and persistence design; it is not enabled by this PR.                                |

## Reproduced scroll defect

Chromium 151.0.7922.34, local development build at `99f7b03`, reduced motion off,
shared ChatView at 432 by 720 pixels. After scrolling through synthetic history,
clicking return-to-bottom began native motion. The first delivered sample was
`top=1`, `floor=14732`, but `following=false`. Appending 100 response lines changed
the floor to 17136. After settlement the scroll offset remained 14732: 2404 pixels
of new content were left below the reader. This is a current-editor interaction
failure, not a benchmark result attributed to the reference project.

## Verified bounded-history checkpoint

The same synthetic 1,122-character-answer fixture used in the original review
now mounts 40 messages and 784 DOM nodes for a 1,000-message source. Explicit
pagination reached all 1,000 messages with exact first/last source. Ordinary page
anchor drift was at most 0.33 pixels; an expanded cross-window 70-tool group drifted
0.39 pixels while preserving its group, open summary, live reply, draft and focus.
The warmed 1,000-message sample restored in 4.86ms with a 6.12ms pending-timer delay;
the first cold 50-message sample took 21.21ms/23.26ms. These are individual local
observations, not a cross-device latency promise or measurements of model speed.

The complete follow-up design and acceptance record track implementation gates,
actual editor regressions and exact-head CI separately.
