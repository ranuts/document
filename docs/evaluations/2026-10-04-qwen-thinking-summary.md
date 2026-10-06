# Qwen3 thinking pipeline feasibility — 2026-10-04

No adoption. Actual default Qwen3 1.7B produced nonempty completed reasoning prefixes in all six thinking runs, but factual relationships still failed and one Chinese task switched language. Enabling reasoning is not sufficient to make direct document edits semantically reliable.

The same six previously observed English/Chinese regression fixtures ran once each in fixed current→thinking order in the actual IM/Word workflow. This is not fresh heldout accuracy, a causal thinking-switch ablation or a model ranking. Both use the same source/instruction, current system/task prompt and model. Candidate removes the hard disabled-thinking switch and soft no_think text, enables thinking, removes JSON grammar, increases the token budget 512→2048 and changes temperature 0→.6 and top_p .8→.95. A route-local plugin strips one completed think block before the existing strict JSON/date/number/shorter-summary checks; product source, parser and bundled bytes remain unchanged.

These candidate changes follow the direction of the [official Qwen thinking instructions](https://qwen.readthedocs.io/en/stable/getting_started/quickstart.html), which recommend .6/.95 and warn against greedy thinking decoding. WebLLM is a different runtime: no claim that every Qwen recommended sampler (e.g. top_k=20) was applied. Current structured writing intentionally remains deterministic. The candidate is a feasibility pipeline, not a fair single-parameter improvement estimate.

| Regression | Current final response | Thinking final response |
|---|---|---|
| English shipment | Keeps proposer/date/value/pending inspection/unapproved shipment, but omits explicit must-pass prerequisite. | Same prerequisite omission; pending inspection is not a passing result. |
| Chinese shipment | Keeps proposer and inspection-passing prerequisite; replaces explicitly pending/unapproved status with generic requirements, losing explicit current status. | Switches Chinese source to Danish-like text, multiple sentences and too long; “after inspection” also loses the must-pass prerequisite; existing length guard refuses, original document unchanged. Does not establish a language-specific guard. |
| Payer/recipient | Preserves Sana→Ivo payment/date/service. | Same requested relationships in the observed response. |
| Allegation/denial | Preserves Tomas allegation, Noor denial and no investigation confirmation, but produces two sentences. | “Tomas alleged Noor removed …, denying the claim …” attaches denial to Tomas or makes attribution ambiguous; loses who denied and investigation basis, and adds Tomas as the person reporting the lack of confirmation. |
| Chinese repair | Preserves Rui/planned date/pump count/not arrived/not started, but omits explicit only-if-arrival prerequisite. | Same condition omission. |
| Cancellation exception | Preserves canceled motors order and separate active pumps order. | Preserves cancellation/active exception in the observed response. |

Native mechanics: 12 actual inferences; 11 edits applied with exact selected-text Undo/Redo; one refusal preserved the selected source. No preview cards, no page errors, no truncation stops. Applied text does not imply semantic correctness. Median observed response time: current 2039.5ms, candidate 15136.5ms; candidate range 5832–36754ms. These are six warmed local measurements, fixed ordering and different sampling/budget/grammar, not cold-load or device-wide benchmarks.

The existing owned GPU profile was used exclusively and the browser closed normally. No external HTTP requests were observed in this warm run; the browser was not forced offline, so this is not cold-offline, network isolation or deployed privacy acceptance. No Save/reopen, allocation/thermal measurement, physical device matrix or multi-model coexistence test was performed. Report records full transformed outgoing requests, raw responses, source/instruction and selected text. The verifier checks actual control/mechanical evidence, not semantic correctness. Raw reasoning content is diagnostic, not a proposed IM display or product feature.

Next improvement should address supported same-language writing guards and fresh multilingual task quality tests; do not ship reasoning, weaken guards, or change defaults based on these twelve observations.

Independent read-only final-text review confirmed these condition, attribution, language and one-sentence failures and the stated methodological limits; no candidate adoption is supported.
