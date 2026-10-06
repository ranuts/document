# Local context budget: complete tool exchanges

Current code inspection: `runtime.ts` passes a request-only copy with the current editor scope to `budgetMessages`, preserving archival user text. `context-budget.ts` budgets UTF-8 serialized role/content bytes plus a per-message allowance, discards older complete user turns, and regards user-role tool results as continuations rather than fresh requests. The GPU and CPU providers add their system instructions separately. The budget therefore does not measure tokenizer counts, system prompt, tool schema or exact serialized provider request size.

The expanded tests verify:

- Exact byte boundaries for Chinese, Emoji, escaped newline/quote/backslash content and combining characters. A one-byte smaller budget refuses the complete current request rather than splitting its text.
- An oversized old Chinese/Emoji history is trimmed while the current Excel B2:C2 reference scope survives three inference calls and both complete tool call/result pairs, with matching call IDs and exact returned data.
- Trimming notification occurs once per run; both tools execute once. The original archive remains intact and the request-only scope is not saved in the user message.
- When a tool result makes the current turn too large, the runtime refuses before a second inference or tool replay. It does not remove the tool result and retry an incomplete exchange.

Validation: 24 tests in `agent-context-budget.test.ts` and `agent-runtime.test.ts` passed; scoped Oxlint, TypeScript and diff whitespace checks passed. No product behavior changed, so no additional build/full suite was required. Provider responses and tool execution are scripted in these tests; they establish runtime orchestration and byte-budget behavior, not real model generation, editor side effects, native token capacity, browser memory or UI notification accessibility. Existing native context-window errors remain necessary because this byte budget is an estimate. Real long-conversation quality and physical-device resource limits remain unproven.
