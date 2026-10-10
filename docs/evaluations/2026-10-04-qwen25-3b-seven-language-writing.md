# Qwen2.5 3B: current production writing baseline

Do not adopt Qwen2.5-3B-Instruct-q4f16_1-MLC as default. All 21 tasks finish on actual desktop WebGPU, but 20 outputs are refused and multiple malformed-date/language/fact failures remain. Increased size does not establish better quality.

Driver/verifier preregistered in `96a21ad` before execution. Same already-evaluated seven-language rewrite/summary/translation fixtures as the 1.5B run, one fixed-order sample each; not fresh heldout/general accuracy. Actual current product writing route, prompts/schema/guards, temperature 0, top_p 0.8, max_tokens 512; no Qwen3-specific extra_body/thinking controls. Custom installed-SDK catalog id selected only in the diagnostic profile. Route-local plugin response instrumentation records actual Worker inputs/raw outputs without replacing model outputs or native editor results. Bundles remain unchanged during inference. Production defaults stay unchanged.

## Manual findings

Several summary outputs insert unexplained material inside ISO dates: Chinese “2044-09- Quick-23”, English “2044-09-觇”, Japanese “2044-09-思路23”, Korean “2044-09-觇3”, Spanish “2044-09-觇▌”, Portuguese “2044-09-觇”. Actual captured sources contain the correct 2044-09-23. Date guards refuse these outputs and retain source. This is observed output corruption/malformed generation; the run does not isolate model training, compiled precision, GPU/runtime or grammar-decoding cause. Do not assume it is exclusively a prompt/model quality problem without controlled investigation.

Other refusals include Chinese rewrite switching to English and prose date/spelled-out quantity; Chinese translation omitting Teo from the alleged action and using February 1 rather than 11; Japanese rewrite switching EUR to dollars; Korean rewrite dropping the date and changing the reverse-payment clause into Alba not receiving money from Neri, which contradicts the main payment direction. Translations change literal date formats/personal-name spellings or omit investigation relationships. Spanish/Portuguese rewrites retain informal greeting while changing ISO dates or quantity to words.

The one applied German summary retains proposer, filter count/value/date, condition and pending inspection/authorization, and omits parking. It links these with causal “da” (because), a relationship not explicitly stated in the source. Its native application is not a correctness certificate. Review remains manual; original source repayment vocabulary in English/German is not by itself labeled unsupported.

## Verification and next investigation

`python3 docs/evaluations/verify-qwen25-3b-seven-language-writing.py` passes 21 actual requests with exact source/instruction/task/target, seven-language/three-task coverage, actual model/engine, settings/schema and absent extra_body, current bundle/driver hashes, no previews, source retained on refusals, and exact native Undo/Redo for the applied output. Report completes without harness errors. External model downloads are recorded, so this is not offline/privacy certification.

This and the 1.5B run share current build/task settings; older model reports used earlier guards/prompt controls, so the larger index is not a global ranking. Cold offline/PWA, Save, CPU/mobile compatibility and broad quality remain unproven. A controlled alternate-precision/catalog-variant screen on malformed-date cases is the next useful investigation; do not change defaults or weaken literal guards to make more edits apply. No push/merge/deploy.
