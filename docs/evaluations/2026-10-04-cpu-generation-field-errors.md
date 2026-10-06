# CPU settings recovery and visible generation statistics

The product after `46ba186` was exercised with an owned warm Chromium CPU profile, navigator.gpu deliberately unavailable and the panel default provider retained. The native engine status identifies `CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf`. No experimental COOP/COEP response headers were applied by this driver.

Through the actual settings UI, maxTokens=99999 marks only that field aria-invalid=true. The configured system prompt, temperature 0.4, top_p 0.85 and max_tokens 96 are then entered and all field errors clear. A subsequent IM greeting request produces `Hello! Let me know if there's anything you need.`; captured message text also includes the existing Write to document action. No page errors, message errors or previews occur. Native empty Word text is unchanged.

Visible statistics report decode speed 37.7 token/s, first text 0.92 s, overall response rate 10.72 token/s and 13 tokens. These are displayed runtime values, not independently measured throughput or latency. The three timings have distinct meanings and must not be treated as interchangeable.

The inherited Worker interceptor only observes WebLLM streaming messages, so inputs=[] is expected and does not prove the CPU's internal effective generation parameters. Static wllama.ts source forwards generationParameters and systemPrompt to createChatCompletion, but that is narrower evidence than an actual captured CPU request. The verifier checks actual engine status, validity maps, reply, displayed statistics and unchanged text, and binds the raw report to the executed driver SHA-256. Empty-document Undo/Redo is ignored.

Scope is one English warm CPU chat with network available and service workers blocked. The default local provider can fall back to CPU; the earlier report did not capture the selected provider. This does not independently certify the full fallback lifecycle, cold offline operation, physical-device compatibility, screen-reader acceptance or privacy certification. No new product change or default model change was needed.

Correction after provider-control inspection: setting localStorage agent-panel-provider does not select the runtime provider; the panel constructs its selector with webllm by default. Earlier wording claiming explicit wllama selection was incorrect. Raw reports and executed drivers are preserved; actual CPU engine/reply observations remain valid. The offline-model-reload follow-up records the selected provider directly.
