# CPU IM measured context budget

The runtime now skips its default UTF-8 byte budget only when the ready provider reports exact final-request token budgeting. Explicit `maxContextBytes` remains enforced; providers without this capability keep their existing byte budget. Request arrays are copied to prevent archive additions from mutating a provider request.

Validation: 71 tests across the context budget, runtime, local provider and wllama provider suites passed; root TypeScript, scoped lint, diff checks and production build passed. The regression covers a 10,000-character request, explicit byte-limit rejection, and capability readiness/disposal.

The actual built Word IM CPU fallback accepted a 10,018-byte input and replied “Hello!”. Observed worker actions began with `count_chat` then `completion`. A 1,900-character difficult-token system prompt produced only `count_chat` and the existing actionable error; restoring the short prompt allowed generation. All three cases had zero preview cards and no page errors. The driver only observes worker actions and forces CPU capability detection; it does not replace the SDK, rewrite requests or inject an engine. Service workers were bypassed to test the current build.

Raw evidence: `2026-10-04-cpu-count-im-long-input.json`; driver: `probe-cpu-count-im-long-input.mjs`; verifier: `verify-cpu-count-im-long-input.py`.

This establishes one Chromium CPU IM path. It does not certify model semantic fidelity, CPU document tool execution, full offline launch, mobile support, or the IM Stop button.
