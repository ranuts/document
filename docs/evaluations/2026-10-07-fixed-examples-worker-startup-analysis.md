# Fixed-example diagnostic Worker startup investigation

The active 21-request diagnostic had no loading progress or completions after nine minutes. Its intercepted Worker response replaced the production body but omitted the production response headers. Syntax checking of the exact instrumented Worker bytes succeeded.

Two independent Chromium startup probes used the same instrumented Worker bytes and no model allocation. The response without the production headers emitted one Worker error event with no exposed message. Restoring the production COEP, COOP and Worker CSP headers produced no Worker error in the same three-second observation. This is evidence of an interception-related startup issue, not a model-quality result or a completed inference run. The short control does not prove model readiness.

The original inference process remains subject to its original ten-minute timeout. Its evidence must be preserved before any corrected run. A follow-up must retain the served Worker response headers and collect Worker errors explicitly, with new bindings; it must not overwrite the original record or claim a successful 21-output result from these probes.
