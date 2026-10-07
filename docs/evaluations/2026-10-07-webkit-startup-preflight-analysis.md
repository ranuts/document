# Desktop WebKit CPU startup regression

The current production build loaded the existing local Qwen3-0.6B GGUF in one fresh desktop Playwright WebKit context. The new native readiness preflight counted Ready. as 14 prompt tokens with 2048 context tokens before any completion. The loaded context reported vocabulary 151936, context 2048 and four actual threads. A subsequent ordinary English greeting request completed once. No page or chat errors were observed; context and browser closed and the process exited 0.

The captured reply DOM text includes the localized write-to-document action label. It is not an exact raw model-output receipt. No document mutation, Save/reopen, offline restart, large-model failure cleanup or semantic-writing acceptance was attempted. This is desktop automation, not physical Safari/iOS or mobile verification. Browser version was not captured.

Runtime/driver hashes were first captured after process launch and remained unchanged at archival. They are explicitly not an immutable prelaunch protocol binding. No product code, model default or inference policy changed.
