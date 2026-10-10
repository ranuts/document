# CPU writing and numeric fidelity

The current 0.6B fallback was retested with the production writing prompt/schema and actual four-thread native execution. The same loaded model handled three distinct requests. Chinese and English formal rewrites changed ISO dates into localized forms and were rejected; the negation summary shortened the source while retaining the proposal, amount, date and unapproved state. Native response measurements were approximately 9.2, 3.6 and 7.2 seconds. Later requests can reuse prompt prefixes, so these are single observations, not independent latency benchmarks. No preview cards or source-content network requests were detected by the probe's literal URL/body check; that check is not a complete network privacy audit.

The official [Qwen3 1.7B GGUF repository](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF) provided Q8_0 at pinned revision `90862c4b9d2787eaed51d12237eafdfe7c5f6077`. The file's 1,834,426,016 bytes and SHA-256 `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a` matched the repository API metadata. This is a larger desktop candidate, not a mobile-size fallback. It loaded through the existing local GGUF file setting, with WebGPU disabled, actual four-thread CPU execution and real configured preview isolation headers.

| Candidate task | Result | Observed response |
| --- | --- | --- |
| Formal Chinese | Rejected: localized date and comma removal from amount | 25.1 s |
| Formal English | Applied: literal date/amount retained; “scheduled” and “as indicated” need semantic judgment | 7.3 s |
| Negation summary | Rejected: only changed capitalization, not shorter | 20.4 s |
| Negative amount formal rewrite | Applied: expanded hasn't into has not; -1,250 EUR and date retained | 7.0 s |
| Chinese to English translation | Applied: name, date, amount and negation retained lexically; date attachment remains potentially ambiguous | 19.3 s |

Three applied results do not prove full semantic fidelity. Both explicit failure cases retained the exact source selection. This candidate is not adopted and the default model is unchanged. Tests used one desktop Chromium session per variant, current stochastic defaults, and one observation per distinct request. They do not establish statistically reliable quality, model HTTP-cache/offline support, physical-device memory limits, or native Save/Undo roundtrips. Baseline port 5193 used injected same-origin isolation headers; candidate port 5194 used actual configured headers. Both blocked Service Workers for diagnostic capture. The current three primary prompts are unchanged; the candidate ran after the numeric guard fix, which does not change model input.

## Numeric validator correction

The previous unsigned number multiset allowed `2026-10-08` to become `2026-08-10`, or `-1,250` to become `1,250`. Seven tests reproduced these erroneous acceptances before the correction. Validation now treats ISO dates as whole literals and preserves signs immediately attached to numeric values. Four positive controls retain ordinary amounts, signed decimals, exact ISO dates, and hyphenated numeric ranges. The multiset and task-specific omission rules remain in place. Non-ISO dates, spaced signs, numeric associations, names and general semantic fidelity are not established by this check.

Build, 116 test files / 4120 tests, root lint and diff checks passed. Read-only review found no Important/Critical issues. The diagnostic runner restored the exact generated plugin and engine bundle bytes in finally; final plugin SHA-256 was `cd260ed848561d92d6bafd7b07f1652baeb106580ec2c4054bff4311ba7a98c7`, engine SHA-256 `0e195b0b3450067e12a30569a03f584fc41a7d7ef57cf66f4dc92a82e9315d61`. Reproduce with `CPU_WRITING_MODEL_FILE=<verified GGUF path> python3 docs/evaluations/run-cpu-four-thread-writing.py`; use the baseline environment values recorded in the probe/report to reproduce the 0.6B run.

Next experiments should improve formatting fidelity without weakening validation, and test changed representations of protected facts or stronger suitable-size models. A prompt-only literal reminder was already unsuccessful; avoid repeating that experiment without a materially different hypothesis.
