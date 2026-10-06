# Actual IM CPU count acceptance

The current production build is opened in the owned CPU evaluation profile with service-worker bypass. Navigator GPU is disabled to exercise the normal application's local CPU fallback. No engineFactory, SDK method replacement, request rewriting or native response fabrication is used. A Worker subclass observes main-thread action names without altering messages. The visible engine is CPU Qwen3 0.6B. Native logs show the exact built default count WASM filename and an actual four-thread pool.

A normal short prompt produces count_chat before completion and a visible greeting. A 1900-character custom system prompt then produces only count_chat, no completion or assistant reply, and the existing actionable context-too-long error with Restore request. Replacing it with the short system prompt produces count_chat followed by completion and a new greeting. No page errors or preview cards occur. The built plugin bytes remain unchanged throughout the probe. No document write is executed; the greeting's Write to document label is an existing UI action, not generated model text.

The first driver run confirms normal count/generation but then fails because it toggles an already-open response-settings details element closed. That raw failure is preserved. The corrected driver opens the details element only if closed and completes all three scenarios. This fixes test automation, not product behavior.

This establishes actual IM normal-loader/default-CPU count and overflow recovery for one Chromium profile. It does not click Stop, verify the trimming notice or full PWA offline flow, certify semantic fidelity, or establish compatibility/mobile/private-mode acceptance. Runtime byte budgeting still runs before the provider and can reject or discard input even when exact counting would fit; removing that redundant limit for measured providers requires separate integration.

Verification: `python3 docs/evaluations/verify-cpu-count-im-recovery.py`.
