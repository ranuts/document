# CPU zero output limit feasibility result

The captured native CPU request used `max_tokens=0`, but still generated `Hello` and the UI reported one output token. This completion call is therefore unsuitable as a count-only preflight. No production implementation or model default was changed.

The original UI limit was 96. The actual SDK capture proves only the limit was replaced: system instructions, contextual user message, temperature 0, top_p 0.8 and streaming were retained. The SDK route was intercepted with service-worker bypass. The current plugin bundle remained unchanged; the run completed without captured errors or preview cards. No document write or Save was invoked.

The raw reply capture includes the existing “Write to document” action label (`HelloWrite to document`); that label is not model-generated text. Statistics describe output tokens, not the full prompt token count. This single short request does not determine all SDK zero-limit semantics or identify the underlying implementation cause.

The raw report's inherited scope string mentions “current/request-first order”; this probe actually has one `zero-limit` variant only, as its captured cases and requests show. Raw evidence is preserved unchanged. Full-template context budgeting, including system instructions and reserved output, remains unresolved.

Evidence: [plan](2026-10-04-cpu-zero-token-limit-plan.md), [raw capture](2026-10-04-cpu-zero-token-limit-diagnostic.json), [driver](probe-cpu-zero-token-limit-diagnostic.mjs), [verification](verify-cpu-zero-token-limit-diagnostic.py).
