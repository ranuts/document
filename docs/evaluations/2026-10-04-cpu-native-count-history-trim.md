# Whole-turn history trim with actual native counts

The isolated 2048-context CPU test completed and the predeclared verifier passed. Full request count was 2127 tokens, exceeding capacity before output reservation. Removing the oldest complete synthetic turn reduced the prompt to 1111 tokens; subsequent actual generation reported exactly 1111 prompt tokens and 10 output tokens. The captured request's max_tokens=96 was preserved, and context shifting was disabled in this diagnostic.

The complete retained turn contains user request, assistant function call, matching tool result and assistant acknowledgement. Exact structural comparisons prove it stayed intact. The original application system instruction and current contextual user message were unchanged, and serialized synthetic archive before/after matched. A too-large current turn was counted separately and identified as not fitting even with all older history removed; it was not generated or shortened.

Evidence: [raw capture](2026-10-04-cpu-native-count-history-trim.json), [predeclared driver](probe-cpu-native-count-history-trim.mjs), [verifier](verify-cpu-native-count-history-trim.py). The archive/driver hashes, attempts, final options, usage and counts are retained. Browser and local server closed normally. No editor operation or Save.

This proves the specific prototype strategy on captured application system/current messages plus two synthetic old turns. It does not exercise the application's existing budgetMessages implementation, UI trim notice, IndexedDB history, concurrent abort/reload or GPU path. Native count and application history budgeting still require production integration; no shipped byte-budget behavior was changed. Answer quality and host tool execution are outside this counting test.

Next acceptance gate: count/generation queue cancellation and retirement behavior, then packaging matching native JS/WASM and client glue before adding a provider-aware exact budget. Keep the existing minimal UI and archive-preservation behavior.
