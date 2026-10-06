# Exact context budget implementation

Add `budgetMessagesByTokens(messages, count, reservedTokens, signal?)` in `packages/agent-core/src/context-budget.ts`. `count` asynchronously measures the provider's complete final request and returns `{promptTokens, contextTokens}`. Return `{messages, trimmed, promptTokens, contextTokens}`. Preserve original message objects and archive; remove oldest complete user turns only. Tool-result user messages do not start turns. Reject when current turn plus reservation does not fit. Check cancellation before/after every count, validate nonnegative safe counts and positive capacity, and propagate count errors.

1. Add tests in `test/unit/agent-context-budget.test.ts`: output reservation forces old-turn removal; retained tool pair remains whole; current-turn overflow rejects; pre/post-count abort rejects; invalid count responses reject; caller errors propagate. Run `pnpm exec vitest run test/unit/agent-context-budget.test.ts` and confirm missing helper failure.
2. Add async helper using the existing user-turn boundary rule and sequential awaits. Require `promptTokens <= contextTokens - reservedTokens`; this avoids unsafe sum arithmetic. Start with a copied full array, then remove complete oldest turns until fit or current turn is reached. Repeat the count on each candidate; do not estimate per-message token lengths.
3. Run targeted tests and `pnpm run tsc`. Inspect diff and commit explicit source/test/plan paths.

This introduces the shared algorithm. Provider activation requires matching packaged native/client artifacts and a caller that counts fully assembled options inside the generation queue. Runtime trimming notification and GPU parity remain integration work; this helper alone is not production exact-budget acceptance.

## CPU provider integration progress

`WllamaEngine.countChatTokens` is optional until the paired native/client package is shipped. When present, `WllamaProvider.run` counts inside its existing interruptible serialized operation. It freezes the final system/schema/sampling request, rebuilds only messages for each candidate, and generates with the last measured request. Reservation is max_tokens plus one conservative margin token. Count-stage cancellation retires the engine through the existing interruptible path. An optional `LLMResponse.contextTrimmed` flag forwards provider trimming to the runtime's existing once-per-request notice without mutating archival history.

Tests added: final custom-system/schema request equality between last count and generation, complete old-turn trimming with output reservation, current-request rejection without generation, count-stage cancellation and engine retirement, and runtime notice/archive retention. Initial provider tests failed before implementation. Runtime notice initially failed against stale dist, then passed after rebuilding agent-core. Installed product SDK lacks the new count method; optional-path verification must not be described as active production exact counting. Native/client packaging and full provider browser acceptance remain required.

## CPU loader activation

Vendor the verified dual CPU candidate under packages/agent-core/vendor/wllama-count with manifest, licenses and source patches. Load it only for cpuOnly without an explicit wasmUrl override. Use the existing capability helper with a local compatibility-asset callback; preserve storage selection and provider queue. Check source and emitted native hashes against accepted evidence, normal-preload mock selection, type declarations, relevant tests and full product build. Follow with real normal-loader/IM and offline checks before acceptance.
