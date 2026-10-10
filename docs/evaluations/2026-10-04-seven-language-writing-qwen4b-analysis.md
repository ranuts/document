# Actual Qwen3 4B seven-language writing — 2026-10-04

Qwen3 4B improves some observed summaries and translations over smaller candidates, but does not pass multilingual writing requirements. Do not replace the default on this evidence. Source-language errors, informal rewrites and date-format refusals remain.

This run reuses the 21 predeclared cases and unchanged actual IM/Word driver. All outgoing request objects are identical to the earlier default 1.7B run. Model weights/templates differ; temperature 0, 512-token limit, disabled thinking, schema and guards remain unchanged. The current build includes the intervening localized refusal-guidance fix, so bundle hashes differ from the old comparison, without changing captured inference inputs. Actual captured engine/model is `Qwen3-4B-q4f16_1-MLC`, explicitly selected through the existing model override. Raw scope boilerplate mentioning default 1.7B is inaccurate for this candidate and is preserved as provenance, not evidence of the model used.

| Language | Summary | Formal rewrite | Translation |
|---|---|---|---|
| Chinese | Applied in Chinese with requested facts, but two sentences. | Applied in English; “reverse this payment” changes the denied inverse payer relationship to transaction reversal. | Refused: ISO date localized. |
| English | Applied, one sentence with proposed shipment, count/value/date, passing prerequisite and pending/unapproved states. | Applied, greeting/fillers removed, payment and repayment relation retained in this observation. | Applied; attribution, denial, investigation nonconfirmation and literals retained in this observation. |
| Japanese | Applied, one source-language sentence with requested shipment relations and literals. | Refused: date localized, casual ending remains. | Refused: date localized and names transliterated. |
| Korean | Applied, source-language one sentence with core proposed shipment/prerequisite/status facts; grammar is awkward. | Refused: English, 5→five, inverse-payment denial omitted. | Refused: date localized and names transliterated. |
| German | Applied in German with requested facts, two sentences. | Applied; greeting removed but “okay?” retained. | Refused: ISO date localized. |
| Spanish | Applied, one Spanish sentence with requested relations and literals. | Applied, removes casual prose while retaining core facts. | Applied, allegation/replacement/denial/unconfirmed investigation and literals retained; idiom not independently certified. |
| Portuguese | Applied in Portuguese with requested facts, two sentences. | Refused: original casual source unchanged. | Applied, core allegation/denial/investigation relations and literals retained in this observation. |

Independent read-only final-text review confirmed the important defects and narrow positive observations, including retained German colloquial “fürs”.

These narrow positive observations do not certify native style or whole-language reliability. English/German repayment wording remains narrower than broad inverse-payment rubric wording; do not enlarge the source claim. Assessment is AI-assisted, not professional native-speaker certification. Every language uses the same three relationship templates, English additional instructions, fixed order and one sample: known-regression comparison, not broad ranking or heldout accuracy.

Fourteen edits applied (seven summaries, four rewrites, three translations), all exact native selected-text Undo/Redo; seven refusals preserve selected source. Execution counts are not semantic task success. No previews, page errors or truncated stop reasons; product bundle bytes unchanged within the run. Zero external HTTP requests observed with the warmed profile, without forced offline or cold-launch acceptance. No native Save/reopen, Excel/PPT task inference, physical devices, memory/thermal budget or concurrent workload acceptance. Owned process exited 0 and browser context closed.

Median warmed response times: summary 5352ms, rewrite 4368ms, translation 4141ms. These single fixed-order observations do not establish general performance or resource cost.

The verifier binds driver bytes, cases, actual model IDs, identical requests, selected-source normalization, target-language data and native edit/refusal mechanics; semantic judgment remains separate. No full product build/test repetition was needed for this evidence-only experiment. Fresh task families and device/resource verification remain necessary before adoption. Maintain compact direct edits with native Undo/Save, without introducing preview or confirmation layers.

Source-grounded correction: the seven-language English source explicitly contains pay Neri back, and German contains zurückzahlen. Treating all corresponding reimbursement/repayment wording as necessarily invented was too strong. See [the correction](2026-10-04-repayment-fixture-correction.md), which supersedes that categorical interpretation while leaving raw results, mechanics and independent failures unchanged.
