# Qwen2.5 3B q4f32: simple ISO-date copying

Malformed generation also occurs in short date-copy requests. Simplifying messages is not sufficient: the minimal prompt invents an address for two of eight sources. This is diagnostic evidence, not a proposed production prompt or summary-quality result.

Driver preregistered in `53122db`; eight fixed simple sources include four ISO dates with English labels and four Chinese/Japanese/English/Portuguese appointment statements. Each receives the same date-only instruction. One fixed-order development sample per source with production writing messages versus minimal copy-specific system/user messages. All other actual Worker fields match per pair: model, temperature 0, top_p 0.8, schema and 512 output tokens. The production task is summarize; every source contains a label or statement so date-only extraction can shorten it. Minimal messages are injected only at the diagnostic Worker boundary. No output or native editor-result substitution.

| Source | Production raw text field | Minimal raw text field |
| --- | --- | --- |
| ISO date: 2044-09-23. | Whole source copied; refused | Exact date; applies |
| ISO date: 2044-09-22. | Whole source copied; refused | 204 Walsh Avenue, Dublin, Ireland; refused |
| ISO date: 2026-10-04. | Exact date; applies | Exact date; applies |
| ISO date: 2028-02-29. | Whole source copied; refused | Exact date; applies |
| Chinese appointment, 2044-09-23 | Exact date; applies | 204 Walsh Avenue, Dublin, D01 W234; refused |
| Japanese appointment, 2044-09-23 | 204 Walsh Avenue, Dublin, Ireland; refused | Exact date; applies |
| English appointment, 2044-09-23 | 204 Quick, concise summary needed here. Keep the dates as they are.; refused | Exact date; applies |
| Portuguese appointment, 2044-09-23 | Exact date; applies | Exact date; applies |

Exact date-only output: production 3/8, minimal 6/8. All seven refused results preserve original document text; all nine applied date-only results have exact native Undo/Redo. Sixteen real requests complete without harness page errors, preview cards or observed external HTTP requests during this warm-cache run. These observations do not certify cold offline/PWA, privacy in every route or physical mobile behavior.

The audited assets matched upstream, but simple copy failures still do not isolate model competence, compiled arithmetic, browser GPU behavior or cache/prefix/runtime state. Inspect token-level output and reproducibility with controlled repeated requests before changing defaults. Existing numeric/date guards prevent these captured corruptions from being applied; this does not prove general semantic safety. Do not replace broad writing functionality with date extraction or fixture-specific repairs.

`python3 docs/evaluations/verify-qwen25-3b-date-copy.py` validates all paired request bodies, exact source/expected dates, current bundle and driver hashes, native refusals/Undo/Redo and reports exact extraction counts. The saved raw outputs remain in the JSON report. No production source or model/generation defaults change.
