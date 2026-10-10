# Native default CPU summary temperature comparison

Frozen protocol 3dfdb4a, runtime d71a1e8, full Chromium 151.0.7922.34, exact default CPU binary, six fresh native Word sessions, native advanced temperature input only. SDK records confirm temperatures 0,0,0.7,0,0.7,0; top_p 0.8/max_tokens 512/schema/other fields unchanged. Paired fresh-case request objects identical after removal of temperature. No model/prompt/schema/output modification or hidden retry.

All six complete normal stop with 22–57 generated tokens; output shorter than selected source; actually replace selection and native Undo/Redo restore exact measured before/after. Page/chat errors empty, contexts/browser close. Mechanical operation succeeds independently of quality. SDK completion is captured unchanged and equals actual document after adding native CRLF.

| Run | Fixture | Temperature | Result against frozen quality criteria |
| --- | --- | --- | --- |
| 1 | Prior A | 0 | One sentence but omits not-yet-approved state; fail. |
| 2 | Prior B | 0 | Preserves proposed Friday delivery in this run, but two sentences; fail. |
| 3 | New maintenance | 0.7 | Omits approver 苏宁; two sentences and weakens proposed-arrangement wording; fail. |
| 4 | New maintenance | 0 | Still omits approver 苏宁; two sentences; fail. |
| 5 | New delivery | 0.7 | First clause changes Wednesday proposed delivery to 赵芮 proposing samples on Wednesday; three sentences; fail. |
| 6 | New delivery | 0 | Same first-clause time attachment change; three sentences; fail. |

Preserved original outputs and original criteria establish 0/6 complete case passes in this developer diagnostic, not a population failure rate or reproducibility study. Low temperature is not sufficient to repair factual fidelity or instruction adherence. Historical A/B temperature-0.7 comparison is a single prior observation, so no isolated causal/stability claim. Fresh paired cases likewise have one observation per setting and cannot establish a statistical effect. No proposal to substitute keyword rewriting, silently discard semantic failures or claim host validation checks these relational facts.

Primary model documentation checked on 2026-10-05: [Qwen's official Qwen3-0.6B model card](https://huggingface.co/Qwen/Qwen3-0.6B#best-practices) suggests temperature 0.7/top_p 0.8/top_k 20/min_p 0 for non-thinking mode; its greedy-decoding warning applies specifically to thinking mode. Current UI temperature/top_p match the non-thinking recommendation, but that is not accuracy acceptance for this quantized CPU runtime. Effective native top_k/min_p/mode were not measured in this observer; no assertion of full sampling-profile equivalence. Suggested long generic benchmark token budgets also do not justify increasing the current bounded simple-summary budget: all measured completions stop far below 512. No recommendations applied blindly and no new product knobs or warnings added.

No product/default/budget/prompt change; no new unit/build claim for evidence-only work. Full summary quality remains unachieved. Both fresh fixtures become development data after this run. GPU, device, deployment privacy and broad model-quality gates remain open. Actual same-origin preview build identity checked separately against prior runtime shared-chunk SHA.
