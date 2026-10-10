# WebGPU structured-writing sampling experiment

Decision: do not change production sampling. Raising temperature from 0 to 0.7 did not reliably improve faithful writing, and exposed additional failures accepted by the current literal guards.

## Method and retained evidence

Actual cached Qwen3-1.7B WebGPU inference on desktop Chromium/Metal, native Word selected-text writing. Three new fixtures, two repetitions each, current/sampled order reversed on repetition two. Only the structured request temperature changes; prompts, schema, top-p and token budget stay identical. No on-disk bundle or product source mutation. The route-local plugin records actual raw responses. The second run additionally observes actual outgoing Worker requests without mocking their responses.

- `2026-10-03-gpu-writing-sampling-initial.json`: completed initial 12 rows, without outgoing-request capture; exploratory evidence only.
- `2026-10-03-gpu-writing-sampling.json`: completed 12 rows with actual Worker requests. All other request fields compare equal across variants and repetitions for each fixture.
- `2026-10-03-gpu-sampling-cases.json`: exact sources and instructions.
- `probe-gpu-writing-sampling.mjs`: reproduction, using the existing GPU profile and preview at port 5193. The probe was formatted after the second process began; its recorded probe hash identifies the executed pre-format source, not the formatted archive. Bundle hashes remain unchanged.

Both runs applied all 12 outputs, had exact native Undo/Redo for each action, zero previews, zero page errors and zero external requests. These mechanics do not prove writing quality. Service workers were blocked and isolation headers injected for this isolated experiment; no physical mobile, memory, Save/reopen, offline cold-start or hosting claim.

## Qualitative results of the request-captured run

| Task             | Temperature 0, twice                                                                                                                    | Temperature 0.7, twice                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Formal English   | Both replace delivery of supplies worth 42 EUR with delivery of an amount of money. Faithfulness fails despite intact numbers/currency. | First has the same failure. Second retains supplies/value but uses awkward “On the 2032-07-19”. |
| Formal Chinese   | Both retain delivery of supplies/value/date, with awkward “按照 42 EUR 的价值”.                                                         | First gives a clear faithful sentence. Second produces malformed “随值 42 EUR 的物资交付”.      |
| Proposal summary | Both retain proposed delivery of supplies, value/date and awaiting approval.                                                            | Both omit supplies and turn their value into a “delivery of 42 EUR”. Faithfulness fails.        |

In the initial run the sampled Chinese second output also added “预计”, an unsupported qualification. This was not repeated in the request-captured run and is not counted as its result. The initial sampled summary had one faithful response, another money-delivery substitution. Sampling remains variable; small fixture counts cannot support model-wide pass rates or speed benchmarks.

The guards correctly preserve literal dates, amounts and currencies here, but cannot prove what is delivered or whether a value becomes an object. Native reversibility limits recovery cost; it does not make factually wrong edits acceptable. Broad model quality remains unproven. Next work should target semantic fidelity with independent fresh fixtures and model/prompt comparisons, rather than adopting higher temperature or declaring applied edits successful.

## Verification

The completed request-captured report was checked for 12 rows, actual temperatures, equality of every other Worker request field per fixture, exact Undo/Redo, no error messages, zero preview cards and unchanged bundle bytes. Syntax, formatting and repository lint are checked separately. No production code changed, so a fresh build or full product test rerun is unnecessary for this evidence-only experiment.
