# Structured native count rejection fix

The previous runtime failure is the red reproduction: unsupported content parts throw through the nullable native action return, which leaves the glue magic in the response-length buffer. Keep that raw report unchanged.

The revised isolated [patch](cpu-native-count-structured-rejection.patch) adds explicit success/error fields and initializes counts to zero for failure. Count request parsing, input checks and native template/tokenizer errors are caught inside the count action and serialized as its regular response. The client interprets success=false as a readable rejection rather than decoding a null pointer. This changes only the count prototype, not the SDK-wide exception path.

The revised [runtime driver](probe-cpu-native-count-structured-rejection.mjs) preserves each count response and completed comparison in page state, copied into the raw report in finally. It retains the same four usage comparisons, repeat-count checks, oversized custom system case, unsupported-content rejection and subsequent count/generation recovery checks. Failure responses must contain the expected reason, and subsequent generation must remain identical to the first deterministic greeting. Compilation reached linking without errors; runtime acceptance is still pending on build session `30964`.

No product code, native production artifact, UI or model default is changed. Passing this subset would still leave tool/schema counting, exact context boundary/output reservation, lifecycle and broader browser acceptance open.
