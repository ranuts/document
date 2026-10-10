# Llama 3.1 8B: completed browser writing evaluation

Decision: do not adopt as the default or claim seven-language writing acceptance. The retry completed all 21 known fixtures on actual WebGPU Llama-3.1-8B-Instruct-q4f16_1-MLC. Eleven outputs changed native Word text; ten were refused with original text preserved. All eleven edits had exact native Undo/Redo. No page errors or preview cards were recorded; served bundle bytes were unchanged and the browser context closed. No native Save occurred.

The first load failed while fetching/storing weights shard 40, then fell back to CPU with zero writing cases. Its exact Worker throw and fallback engine are independently verified. A separate retry retained existing cache and successfully loaded Llama. This establishes recovery for this run, not automatic network retry behavior, universal artifact reliability, offline cold start, cache body integrity or a measured memory requirement. The host had 16GiB RAM and SDK listed a 5001MB VRAM estimate; neither proves a general 8GB+ GPU device guarantee.

Quality failures remained after successful loading:

- Japanese and Spanish summaries returned English; German and Portuguese rewrites also returned English.
- English summary reduced the prerequisite to pending inspection and omitted unauthorized shipping. German summary omitted pending inspection and unauthorized shipping despite retaining the passing-inspection condition.
- Korean translation did not retain Teo as the explicit sensor-replacement actor and replaced the investigation-confirmation clause with generic unconfirmed status; original spellings appeared only alongside transliterated names.
- English translation changed no investigation has confirmed into no evidence to confirm, a broader claim.
- Several rewrites recast the denied reverse payment as reimbursement, adding a payment relationship absent from the source. Refused Spanish rewrite reversed the payer and then contradicted itself.
- Refused Chinese translation changed the date to 2022, and other refused translations changed ISO date format. Mechanical rejection protected source text but does not count as successful writing.
- Portuguese translation visibly retained allegation, Teo's denial, names, quantity, ISO date and investigation confirmation status. That isolated reasonable result does not establish broad quality.

Run `python3 docs/evaluations/verify-llama31-8b-seven-language-writing.py` without --partial for completed 21-case identity, actual model/input, production sampling/schema, native source/target controls, preserved refusals, Undo/Redo and unchanged bundle. The verifier checks mechanics rather than semantic correctness. These are previously known fixed-order single samples, not heldout accuracy; model-specific prompts and later guard changes differ across older reports. Initial/retry network observations do not comprehensively audit Worker privacy. No production model, prompt, interface or cloud inference path changed.

Source-grounded correction: the seven-language English source explicitly contains pay Neri back, and German contains zurückzahlen. Treating all corresponding reimbursement/repayment wording as necessarily invented was too strong. See [the correction](2026-10-04-repayment-fixture-correction.md), which supersedes that categorical interpretation while leaving raw results, mechanics and independent failures unchanged.
