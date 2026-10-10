# Qwen2.5 3B q4f32: repeated date copying and Worker token boundary

The captured malformed address is generated token by token inside the engine. It is already present in the full Worker completion and remains byte-for-byte unchanged through provider parsing. This localizes the anomaly before application parsing or document application; it does not isolate model competence, compiled model arithmetic or browser GPU behavior.

Driver preregistered in `6cda0ea`. Four previously observed simple date-copy development cases, three repetitions each, one owned native Word IM engine session. Every request uses the same minimal date-copy messages for its source, JSON schema, temperature 0, top_p 0.8 and max_tokens 512. Baseline leaves logprobs unset; logged adds only logprobs true/top_logprobs 5. Paired order reverses for repetition 1. The Worker response listener records completions without modifying them; the existing route-local raw provider hook and native results are also recorded. No generated-output substitution or production change.

| Source | All six raw text fields |
| --- | --- |
| ISO date: 2044-09-22. | 204 Walsh Avenue, Dublin, Ireland |
| Chinese appointment, 2044-09-23 | 204 Walsh Avenue, Dublin, D01 W234 |
| ISO date: 2026-10-04. | 2026-10-04 |
| Portuguese appointment, 2044-09-23 | 2044-09-23 |

All six requests for each source return identical raw text across repetitions and logging modes. Each of 12 logged token sequences reconstructs the Worker content exactly after removing the final im_end stop token. For the English-labeled 2044-09-22 source, sampled tokens are `2`, `0`, `4`, then ` Walsh`, ` Avenue`, comma, ` Dublin`, comma, ` Ireland`; no fourth date digit is generated. This is not a decoded date string later replaced by the editor.

The installed SDK samples from its temperature-scaled probability distribution and retrieves token logprobs from that distribution. At requested temperature 0 it clamps temperature to 1e-6. Logged chosen tokens have logprob 0, with underflowed alternative logprobs serialized as null; these are not calibrated model confidence or useful estimates of uncertainty. Enabling logprobs also adds GPU-to-CPU probability reads and synchronization, so the logging contrast is not assumed transparent; matching outputs are an observation in these 24 requests only.

Twelve corrupt results are refused and preserve source text. Twelve exact date-only results apply with exact native Undo/Redo. No page errors, previews or observed external HTTP requests occur during this warm-cache run. None of this establishes general semantic safety, cold offline/PWA/privacy, physical mobile behavior or determinism across other engines/requests/devices.

`python3 docs/evaluations/verify-qwen25-3b-date-tokens.py` checks all 24 requests, repetition/variant order, only logging fields differing per pair, stable captured texts, full Worker/provider equality, token bytes/reconstruction, current bundle/driver hashes and native refusal/Undo/Redo mechanics. Inspect an independent runtime or model representation next rather than adopting a speculative prompt or date-repair regex. Production defaults remain unchanged.
