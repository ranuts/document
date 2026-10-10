# Chinese writing-rule translation diagnostic

Five previously observed Chinese cases run in fixed current/candidate order once each on actual default Qwen3-1.7B WebGPU. Candidate translates the task instruction and user-side writing rules into Chinese; original JSON data and provider system prompt remain unchanged. This includes the existing general plain-text rule followed by the request-specific JSON override. No product changes. Translation alters wording/token counts/possible nuances, so this is not a pure language-only causal ablation or fresh heldout evaluation.

Both variants produce three native edits and two refusals. All edits have exact native Undo/Redo, refusals preserve original text, preview count zero, bundle unchanged and no harness errors. Browser closed; no Save. These are mechanics rather than semantic scores.

Approved-payment candidate preserves approval and direction but changes ISO date to Chinese formatting and CNY wording; refused. Not-approved candidate recovers the missing date but still changes CNY to Chinese currency wording; refused. Pending-inspection candidate retains pending non-pass status and unauthorized shipment but loses the explicit pass prerequisite; applied. Passed-inspection candidate fits one sentence and preserves prerequisite/current pass/unauthorized status, but still omits the requested date; applied. Allegation candidate retains claimant, alleged actor, denial, unconfirmed status, date/count and excludes menu; narrow observed positive.

Do not adopt this rule translation on these results. It does not stably solve literal preservation or requested fact retention, and worsens an explicitly required prerequisite in a previously faithful summary. Language selection, semantic fidelity and style remain separate open quality requirements.

Run `python3 docs/evaluations/verify-chinese-writing-rules.py` for fixture/input controls and native mechanics. The verifier checks that only the user message changes and its final JSON line stays exact; the hash-bound predeclared driver contains the translated rule text. It does not score semantic quality or prove Chinese/English rules have identical meaning.
