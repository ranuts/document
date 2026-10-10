# Qwen3-8B native writing screen: partial improvement, no adoption

Actual WebGPU Qwen3-8B-q4f16_1-MLC completed the four predeclared known Chinese/English writing cases. Exact status title and every Worker model ID match. The verifier confirms actual inference requests are identical to the default Qwen3-1.7B four-case report, including system/user/schema/sampling/non-thinking controls; only Worker model identity differs. One sample each fixed order is not a controlled broad quality ranking or repeated reliability test.

Initial load downloaded catalog model shards: the last captured download heartbeat showed 111/113 shards, 4324 MB and 98% at 180 seconds. These UI figures are not independently measured transfer totals or RAM. SDK VRAM estimate 5695.78 MB is not actual allocation. Model eventually loaded as the required GPU candidate, not CPU fallback. Browser closed, bundle unchanged, no harness errors.

| Task | Captured raw output / native outcome |
| --- | --- |
| Chinese formal rewrite | Removes casual greeting and preserves future Cora -> Davi payment, amount/count/service and reverse-payment denial. Changes ISO 2047-06-12 to 2047年6月12日 despite exact-literal instruction. Refused; original preserved. |
| Chinese summary | One shorter sentence retains Lena's proposal, date/count/value, inspection-pass prerequisite, pending inspection and unauthorized shipment; omits parking. Narrow semantic improvement over default case. Changes ISO date into Chinese format. Refused; original preserved. |
| Chinese translation | Retains Suri claimant, Vero alleged actor/denier, ISO date/count and unconfirmed investigation in natural Chinese. Applied; exact native Undo/Redo. Isolated positive, not broad translation acceptance. |
| English formal rewrite | Preserves future Cora -> Davi direction and reverse-payment denial, but changes pay into reimburse, introducing a repayment/reimbursement interpretation absent from source. Applied despite semantic change; exact native Undo/Redo. |

Two native edits and two refusals; previews zero. These are mechanics, not semantic scores. No Save. Initial verifier assumed every raw result lacked a final newline and failed on the translation's trailing LF; it was corrected to model native LF->CRLF/paragraph terminator normalization while preserving body text. The original captured report was not edited.

Do not adopt default on this screen. Larger capacity improved some condition/attribution outputs but still changes requested date format and introduces reimbursement semantics. Date guards protected source for two cases, while an English meaning change still passed. This distinction matters: refusing formatted dates is not successful task completion, and native Undo does not certify facts.

The [predeclared plan](2026-10-04-qwen3-8b-evaluation-plan.md) links original publisher documentation; publisher claims do not certify this MLC browser workflow. Run verify-qwen3-8b-document-writing.py for exact cases/requests/model identity, application/refusal and native history. Seven-language coverage, fresh heldout cases, repeated reliability, offline startup, physical mobile/high-memory-device matrix and universal formatting/Save remain unaccepted. A broader seven-language run is a useful next screen if pursuing this candidate, but no prompt/guard/default change is justified yet.
