# Follow-up performance scope

The user requested another performance pass with one commit per feature, collected in one PR. Continue PR #266 from 0131b526, keeping its previous reviewed commit and adding three independently reviewable feature commits. User-requested commit granularity overrides the PR helper's default one-commit requirement.

## Evidence

| Finding                                                                                                              | Evidence                                                                                                                       | Status                                                     |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Restoring messages repeatedly scans all historical action controls and reads scroll geometry after each inserted row | packages/chat-ui/src/chat-view.ts append/updateRestoreState/scrollToEnd; two restoration loops in lib/agent-plugin/ui/panel.ts | Source verified                                            |
| Streaming rewrites the entire response into data-source every frame although live actions are hidden                 | chat-view.ts flushStream/endStream; styles.ts; answer getters exclude streaming rows                                           | Source and consumer search verified                        |
| Expiry sweep reads and sorts all history metadata before filtering                                                   | lib/history/store.ts sweepExpired/readAllDocs; db.ts DOCS_BY_UPDATED already exists                                            | Source verified                                            |
| Updating or reopening a document restarts its retention period                                                       | lib/history/types.ts expiresAt                                                                                                 | Source verified; compatibility constraint                  |
| GGUF shard deletion repeatedly enumerates the complete model cache                                                   | model-cache.ts deleteCachedGGUF; installed Wllama CacheManager.delete delegates to deleteMany/list                             | Source verified                                            |
| Local editor reload trace reports CLS 0.06, without LCP or field data                                                | Chrome DevTools trace NAVIGATION_0, unthrottled local preview                                                                  | Local diagnostic only; no network-speed or real-user claim |

## Changes and boundaries

1. Chat rendering: packages/chat-ui/src/chat-view.ts, its package guide, the two conversation-restoration loops in lib/agent-plugin/ui/panel.ts, and targeted unit/browser tests. Initialize action state within a new row, update old rows only on relevant state transitions, add appendMany using the existing renderer with one final scroll update, and finalize streamed source metadata at completion. Preserve normal append's return value and behavior.
2. History expiry: lib/history/store.ts and targeted history tests. Read only potentially expired rows via the existing updatedAt index, then retain the precise expiry predicate and return ordering.
3. GGUF cache deletion: packages/agent-core/src/llm/model-cache.ts and targeted model-cache tests. Resolve the requested group, then use one SDK batch deletion over exactly its known file IDs.

The corresponding validation record lives in docs/explorations/2026-10-13-follow-up-performance.md and evolves with each feature commit.

Untouched: vendor binaries/scripts, dependencies and lockfile, storage schemas, retention settings, providers, inference defaults, autosave timing, external services, production deployment. The main checkout's pending dependency changes remain outside this worktree.

Compatibility requirements: message order/tool groups, reader scroll intent, busy-state accessibility, copy/application payloads and partial interrupted answers; cancellation/disposal; reopened history and inclusive expiration boundary; stable expired-ID ordering, atomic byte/handle cleanup; exact cache-group membership and missing-group/failure behavior.

## Acceptance and verification

- Message restoration visits controls linearly and performs one final scroll update. Streaming source metadata is finalized once, with completed/interrupted payloads unchanged. Verify operation-count regressions, existing chat and panel tests, and mounted Chromium conversation interactions.
- A fixture of 2,000 recent and five old history records reads five expiry candidates rather than all 2,005 metadata rows. Verify retained/reaped records, exact ID ordering, cancellation and normal snapshot accounting.
- Deleting a model with multiple shards scans the cache a constant number of times through the actual SDK and leaves unrelated entries intact. Verify exact filename membership, metadata removal, missing group and partial failure propagation.
- Run full unit coverage, lint/type/format checks, production build and affected Chromium E2E; independently review the final diff.
- Commit each feature separately, validate clean branch/non-main target/current base and commit boundaries, push the branch normally and update PR #266. No merge or deployment.

## Simpler alternatives and deferred work

Use row-local initialization and a small batching method instead of virtualizing history. Use the existing index instead of a new expiry schema. Use the installed SDK's batch deletion instead of reimplementing its storage semantics. Keep complete conversation snapshot validation because callers may mutate loaded messages in place; identity-only caching would miss legitimate edits. Defer default history cursor pagination because reversing equal timestamps changes tie ordering and filtered views still need scans. Formatter caching has small per-page absolute cost and is outside this pass.
