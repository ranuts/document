# Generic source-language rule diagnostic

Default actual WebGPU Qwen3-1.7B-q4f16_1-MLC, 12 previously known non-English summary/rewrite cases, paired current and candidate in fixed order, one sample each. This is a prompt diagnostic, not a heldout quality acceptance test. No production prompt or model changed.

Candidate prepends a generic instruction to use the source text language rather than the instruction language, preserving intentional mixed-language passages, original names and numeric literals. It does not interpolate fixture language labels. Captured complete Worker requests match after removing that exact prefix; temperature 0, JSON schema, 512-token limit and thinking-disabled settings remain identical. The candidate repeats preservation guidance, so improvements cannot be attributed solely to language wording.

Both variants produced 7 native edits and 5 refusals. These are mechanical outcomes, not quality pass counts. All edits had exact native Undo/Redo; refusals preserved the original selection, preview count was zero, and the served bundle remained unchanged. All 24 requests completed without harness errors.

| Case | Candidate observation |
| --- | --- |
| Chinese summary | Chinese; retains inspection prerequisite, pending state and lack of shipping approval. |
| Chinese rewrite | Chinese, preserves payment direction; remains conversational rather than formal. |
| Japanese summary | Still English; mentions omission of parking meeting in the output; refused. |
| Japanese rewrite | Restores future payment but adds an unsupported discovery/confirmation claim. |
| Korean summary | Still English; loses the date and invents a pending parking meeting; refused. |
| Korean rewrite | Korean and preserves numeric literals, but remains informal and expresses payment as completed. |
| German summary | Still English and two sentences. |
| German rewrite | Source unchanged; refused. Conversational wording persists. |
| Spanish summary | Spanish with prerequisite and pending/unauthorized state; two sentences despite one-sentence instruction. |
| Spanish rewrite | Source unchanged; refused. |
| Portuguese summary | Portuguese with prerequisite and pending/unauthorized state; two sentences despite one-sentence instruction. |
| Portuguese rewrite | Source unchanged; refused. |

The generic rule does not reliably solve source-language selection or requested register. Do not adopt it on this evidence. The earlier explicit fixture-language prefix was more effective for known-language summary output, but depends on an oracle language label and still failed semantic/style requirements. Neither establishes a production language detector or reliable multilingual writing quality.

Reproduce the mechanical evidence check with `python3 docs/evaluations/verify-writing-source-language-rule.py`. Raw outputs and complete inputs are in `2026-10-04-writing-source-language-rule.json`; the driver is `probe-writing-source-language-rule.mjs`. Browser context closed after completion. No document Save operation was performed.
