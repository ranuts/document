# Local chat settings and visible generation statistics

On product `450116b`, an owned warm Chromium WebGPU profile loaded Qwen3-1.7B-q4f16_1-MLC in a new Word document. Through the actual settings button and collapsed generation controls, the probe set system prompt `You are concise. Answer in English.`, temperature 0.4, top_p 0.85 and max_tokens 96. It closed settings and sent `Reply with a brief greeting.` through IM chat mode.

The intercepted real streaming Worker request contains all four configured values, the product's existing `/no_think` suffix, stream=true and include_usage=true. The visible response is `Hello!`; the captured message text also includes the existing `Write to document` action label. Native document text before and after remains empty, showing that this chat response did not automatically write to the document. No page errors, visible errors or preview cards were recorded.

The visible statistics are `Decode speed: 38.5 token/s · First token: 0.62 s · 2 tokens`. This establishes that the UI displayed nonempty formatted statistics after an actual local stream. The probe does not independently measure these values or bind them to raw incoming usage events; it is not a throughput benchmark or a latency accuracy certification.

The first diagnostic run used a nonexistent `.cui-msg-assistant` selector and failed while reading the response. Its report is preserved as `2026-10-04-configured-local-chat-before.json`; the corrected driver uses `.cui-msg-agent`. The final verifier binds final report to executed driver bytes and checks exact outgoing parameters. The earlier failed driver bytes are not separately retained. Inherited Undo/Redo snapshots in the raw report are ignored: an unchanged chat-only document gives no meaningful history evidence.

Scope is one English GPU chat stream, warm profile, service workers blocked and network available. CPU, other locales, parameter persistence across reload, invalid-input UX, cold offline, privacy and physical devices are not certified. Settings remain page-local by current design. No product change or model default change was needed for this check.
