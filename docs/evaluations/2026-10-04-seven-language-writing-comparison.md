# Actual seven-language comparison — 2026-10-04

Qwen3.5 2B does not resolve the default Qwen3 1.7B writing regressions. No model, prompt, parser or product default changes are justified. This is a known-regression comparison, not a broad model ranking or independent heldout evaluation.

The same committed driver and 21 predeclared cases ran through actual IM/Word operations. All 21 outgoing request objects match across models, including English instructions, temperature 0, 512-token limit, thinking disabled and strict text JSON schema. Native model conversation templates and weights differ. The candidate was explicitly selected as `Qwen3.5-2B-q4f16_1-MLC`; its raw report's inherited scope mentions the default 1.7B, but captured engine/model IDs establish the actual 2B run. Preserve that raw boilerplate rather than rewriting evidence.

| Language | 2B summary | 2B formal rewrite | 2B translation |
|---|---|---|---|
| Chinese | Refused by length: full source returned, including meeting. | Applied in English instead of Chinese. | Refused: ISO date localized. |
| English | Refused: original source unchanged. | Applied; removes greeting and fillers, preserves payment and repayment relations in this observation. | Refused by script guard: Chinese source returned. |
| Japanese | Refused: date localized; English, meeting retained, pending/unapproved states weakened. | Applied in English; “shall” may also introduce obligation. | Refused: date localized; awkward Japanese syntax. |
| Korean | Applied; inspection completed replaces passing, pending/unapproved states lost, meeting retained. | Refused: original casual source unchanged. | Refused: date localized; names transliterated. |
| German | Refused: loses 11, date localized; English and meeting retained. | Refused: original casual source unchanged. | Applied; “no investigation confirmed this” becomes “no investigation was confirmed”, changing the object of confirmation. |
| Spanish | Applied in English, three sentences, meeting retained. | Refused: original casual source unchanged. | Refused: date localized; investigation rather than allegation is unconfirmed. |
| Portuguese | Applied in English, three sentences, meeting retained. | Refused: original casual source unchanged. | Applied; attribution, replacement, denial, unconfirmed investigation and literals retained in this observation. |

Independent final-text review confirmed the important defects. English rewrite and Portuguese translation are narrow positive observations, not language-wide acceptance. Language/style review is AI-assisted, not professional native-speaker certification. English/German repayment wording must not be enlarged into a prohibition on every reverse payment. Applied Spanish/Portuguese summaries also weaken goods-value wording to “for 430 PLN”.

The candidate applied eight edits (three summaries, three rewrites, two translations), with exact native Undo/Redo; 13 refusals preserve selected source. Baseline applied 12 and refused nine. These are execution/guard counts, not task success or accuracy. Both runs have unchanged product bundle bytes, no previews or page errors, and normal stop reasons. Zero external HTTP requests were observed in warmed profiles; neither forced-offline nor cold-launch privacy/cache acceptance follows.

Median response time in milliseconds: baseline summary/rewrite/translation 2061/2023/1948; candidate 3171/2842/2862. These single warmed fixed-order samples do not establish general device performance, loading cost, memory budget or a causal model-size effect. All seven languages share three relationship templates, instructions are English, and each case has one sample. No Save/reopen, Excel/PPT model tasks, physical-device testing or thermal/resource measurements occurred here.

`verify-seven-language-writing-comparison.py` binds driver bytes, cases, actual model IDs, identical outgoing requests, selected-source normalization, translation targets and all native edit/refusal mechanics. It intentionally does not judge semantics. Keep the compact direct-edit/native Undo/Save workflow; improving factual and language reliability remains necessary before model adoption.

Source-grounded correction: the seven-language English source explicitly contains pay Neri back, and German contains zurückzahlen. Treating all corresponding reimbursement/repayment wording as necessarily invented was too strong. See [the correction](2026-10-04-repayment-fixture-correction.md), which supersedes that categorical interpretation while leaving raw results, mechanics and independent failures unchanged.
