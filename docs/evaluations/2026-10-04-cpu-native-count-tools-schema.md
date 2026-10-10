# Tool/schema native count comparisons

The seven-case native prototype run completed successfully. Counts matched actual generation prompt usage for the four previous text cases plus JSON schema response format, a function tool definition, and completed assistant/tool history. Repeated counts matched, preflight action capture contained only count_chat, and the existing overflow/rejection/recovery checks passed again. Driver hash and all per-case options/results are retained in the [raw capture](2026-10-04-cpu-native-count-tools-schema.json).

The new cases supply explicit schema and tool options to both count and generation. This tests template counting, not tool selection quality or host execution: the synthetic read_selection definition was never dispatched to an editor. No document write or Save occurred. One model, Chromium compatibility runtime and limited schemas/history remain the scope; this does not cover arbitrary tool schemas, output reservation boundaries or product integration.

The raw scope string inherits the earlier four-case description; the actual seven recorded requests and seventeen count responses establish this run's coverage. All seven count/usage equalities, repeat counts, action lists, completed phase and driver hash were checked directly. Browser and server closed. Continue with exact context/output reservation boundary tests.
