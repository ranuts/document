# Llama 3.2 3B seven-language writing diagnostic

Actual WebGPU Llama-3.2-3B-Instruct-q4f16_1-MLC completed all 21 previously known cases with current production prompts, temperature 0, JSON schema and 512-token limit. This expands the earlier six-summary diagnostic; it is not a fresh heldout test or controlled model ranking. No product prompt/default changed.

10 native edits and 11 refusals. All edits had exact native Undo/Redo, refusals preserved source, previews were zero, bundle bytes remained unchanged and harness errors were absent. These counts measure mechanics, not quality.

Chinese summary/rewrite produce English; translation reformats the date and names. English summary omits pending inspection and unauthorized shipment; rewrite introduces reimbursement denial rather than simple reversed-payment denial and a literal backslash-n suffix. Japanese summary omits prerequisite, pending status and unauthorized shipment; rewrite changes future to completed payment and adds agreement. Korean summary omits inspection-pass prerequisite and value; rewrite changes repairs into valve delivery; translation repeats until token limit, mixes scripts and loses attribution. German summary drops quantity and pending/unauthorized status; rewrite uses English and changes currency. Spanish summary attributes lack of authorization to inspection instead of shipment; rewrite uses English. Portuguese summary omits date and pending/unauthorized status; rewrite uses English. Several translations reformat dates and are refused; Portuguese translation is isolated plausible output with an unwanted literal backslash-n suffix.

Do not adopt as default on this evidence. Existing guards stop some malformed outputs but do not establish factual fidelity or language correctness for applied outputs. Native Save/reopen, arbitrary formatting, device memory and repeated quality reliability were not tested. Browser context closed after completion.

Check mechanics with `python3 docs/evaluations/verify-llama32-3b-seven-language-writing.py`. Raw complete requests/responses are in the matching JSON, and the predeclared driver is `probe-llama32-3b-seven-language-writing.mjs`.

Source-grounded correction: the seven-language English source explicitly contains pay Neri back, and German contains zurückzahlen. Treating all corresponding reimbursement/repayment wording as necessarily invented was too strong. See [the correction](2026-10-04-repayment-fixture-correction.md), which supersedes that categorical interpretation while leaving raw results, mechanics and independent failures unchanged.
