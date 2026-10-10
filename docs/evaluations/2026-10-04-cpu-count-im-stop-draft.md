# CPU Stop reload draft preservation

Actual current Word IM CPU fallback was stopped after its first visible streamed delta. While automatic engine reload was preparing, a new draft was typed and Enter pressed. The draft remained intact, no error appeared, and the stopped partial reply remained unchanged after one second. The recorded UI still showed Preparing AI at that point. Once Model loaded appeared, the same draft remained; Enter then invoked native count_chat and completion and added a new assistant response.

This clarifies the earlier early-send Stop diagnostic: no generation action while preparing is intentional submission gating, not a lost request. The composer stays editable and preserves the draft. No product code changes or extra confirmation flow were needed. Evidence uses the normal CPU loader with worker action observation only, and checks the current bundle did not change during the run.

Scope: one desktop Chromium Word CPU fallback. The raw JSON and matching probe/verifier are named cpu-count-im-stop-draft. This does not certify all engine/device recovery paths.
