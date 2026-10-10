# CPU runtime update does not solve the observed summary defects

The current patched wllama 3.6.1 CPU pair and official npm 3.8.1 CPU pair produce byte-identical raw JSON content on each of the two frozen known Chinese fixtures. All four real Chromium 151.0.7922.34 calls finish normally and return valid text objects; no page/console error or external request is recorded, and each context/native engine and the owned diagnostic server close. The existing model binary matches the pinned SHA256; client/wasm identities are recorded. No new model file is downloaded. Upstream source: [3.8.1 release](https://github.com/ngxson/wllama/releases/tag/3.8.1), inspected 2026-10-05. Release notes are not treated as quality evidence.

Case one output in both variants: 周宁已收到实验报告，许岚负责审批，预计周四完成。

It distinguishes recipient from approval owner and preserves Thursday expectation, but omits the explicit still-unapproved launch state that the instruction requires. Future approval timing does not satisfy preserving that explicit state. This remains a fidelity failure.

Case two output in both variants: 项目状态：宋远建议周五交付样机，但未获批准。韩岚确认预算后采购零件，预算待确认。

This retains the proposed Friday delivery, lack of approval, Han Lan's confirmation before procurement and pending budget status. It uses two sentences despite the requested single sentence. Do not invent a date reversal in this run or claim the observed earlier actor omission recurred here. The expression for procurement is less explicit than the source's permission-only prerequisite; this diagnostic does not certify all condition/commitment interpretations.

Measured overall model load/completion time: current 11.20/11.71 seconds, candidate 10.79/11.72 seconds, one call per fixture/runtime. These are not robust speed rankings. Prompt usage is 485/493 tokens, completion 22/34, and the reserved 512 output tokens plus one safety token fit context 2048 in all calls. Both use built-in templates, requested CPU-only layers 0, four threads, seed 42, reasoning false. Diagnostic temperature is 0; captured product requests were 0.7. There is no claim these outputs reproduce unchanged current product sampling or prove a benefit of lower temperature.

This is a direct isolated browser runtime comparison, not native IM application, heldout semantic acceptance or an SDK upgrade. The newer runtime alone provides no observed improvement on these fixtures. Product dependencies, exact-count runtime, model defaults and prompts remain unchanged. Any future runtime promotion still requires porting and rebuilding the exact-count patches and verifying both default/compat pairs and full interruption/cache/budget/native workflows. The patched-versus-npm comparison has build/patch confounds, so identical results on two short cases do not prove all native or sampler implementations equivalent.
