# Numeric placeholders: rejected writing experiment

Question: can a changed representation prevent the 0.6B CPU model from localizing ISO dates and comma-grouped amounts, without weakening existing validation? The throwaway runner modified only generated SDK/application bundles. It masked numeric/date literals in the source JSON with DATE/NUMBER markers, added an exact marker-copy instruction, and required each marker once before restoring source literals and running the production writing validators. The selected source document remained unmasked. Generated bundle bytes were restored in finally and their hashes verified afterward. No source writing implementation, prompt default, model default or UI control changed.

The first run captured no slots; its input transformation was unproven and its result is invalid for this hypothesis. That report is retained. The next run unregistered the isolated origin's Workers, removed only agent-plugin/esm generated script entries, and retained model caches. Slot capture then proved the transformed input and restoration executed for all three requests. Cache reset correlates with recovery; the original cached engine bytes were not captured, so the exact cause of the first instrumentation failure is not proven. The shared probe now rejects experimental runs without slot evidence.

| Task | Numeric literals | Actual quality |
| --- | --- | --- |
| Formal Chinese | Date and amount restored exactly | Failed: EUR became 元, changing currency semantics; numeric guard accepted it |
| Formal English | Date and amount restored exactly | Failed: Hey and okay remained colloquial |
| Negation summary | Date and amount restored exactly | One shorter result retained the proposal and unapproved state |

All three native results were applied only in isolated test documents; none used preview cards. This is not three successful writing tasks. The experiment is not adopted. It demonstrates that exact numbers alone do not establish fidelity, and that masking numbers without units can leave important facts exposed to generation. A currency-preservation check and richer quality evaluation are next priorities; do not relax numeric guards or enable this representation based on JSON/marker success.

Actual runtime reported four CPU threads and multithreading for all three requests. These are single stochastic desktop Chromium observations, not reliability statistics, physical-device support or Save/Undo roundtrips. Same-origin isolation headers were injected on the existing 5193 diagnostic server and Service Workers were blocked after unregistering. Reproduce with `python3 docs/evaluations/run-cpu-writing-slots.py` after building; use only the isolated profile in the script.

Final restored generated plugin SHA-256: `7d54a44e493f32190e6dff8f047fae39d604ef56404bb6274de4706678f9162b`; native engine SHA-256: `0e195b0b3450067e12a30569a03f584fc41a7d7ef57cf66f4dc92a82e9315d61`. Product source is unchanged in this turn. Root lint and diff checks passed. Read-only review found no Important/Critical issue. The leakage check only searches for the complete original source in URL/body text and cannot prove absence of partial or transformed content uploads.
