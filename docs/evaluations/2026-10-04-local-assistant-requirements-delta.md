# Current requirement audit: remaining priorities

Historical snapshot: see the [2026-10-05 current-state reconciliation](2026-10-05-current-state-reconciliation.md) for later CPU token-count integration, model evidence and runtime-switch changes.

This audit supplements the October 3 audit after the current product and evaluation changes. The attached original requirements remain authoritative. It is not a completion declaration. Source hashes and baseline HEAD are bound in the companion JSON; historical browser reports prove only their captured build and scenario, unless the current-source scope is explicitly verified.

| Requirement | Current implementation / evidence | Acceptance still missing |
| --- | --- | --- |
| Browser-only inference, no cloud fallback | local.ts constructs WebLLM/wllama; panel currentProvider selects only those two; both providers call local SDK chat APIs | Complete content-egress audit across editor/plugins/SDK paths; broad network permission is not proof of privacy |
| First download, trusted model sources, optional self hosting | Pinned CPU model URL and existing model-source configuration; first-download failure guidance | Every model's provenance/license/download integrity and deployment behavior; initial download is inherently online |
| GPU adapter probe, initialization fallback, Worker execution | local.ts calls requestAdapter; current-build injected GPU initialization failure loads real CPU; status transitions show correct CPU identity | Physical GPU loss/OOM, low-memory device resource cleanup and responsiveness under long inference |
| Streaming, Stop, Retry, clear | Existing provider/controller cancellation and manual recovery tests; browser evidence in previous audit | Broad repeated reliability, crash/device stress; initialization fallback must not replay document edits |
| Cached model + PWA offline app | Archived GPU/CPU new-process warm-cache offline reports | Latest build has not been rerun offline since recent UI changes; WebKit cold navigation and actual device/browser eviction remain unaccepted |
| Recommended desktop 1B/3B/high-end 8B models | Decision index now has 12 raw reports including Llama 1B/3B/8B and Phi mini | No candidate establishes requested multilingual factual writing quality; counts of edits/refusals are not accuracy |
| Lightweight CPU model | Pinned Qwen3-0.6B GGUF runs in CPU fallback | Original Qwen2.5-0.5B suggestion differs; current replacement is an availability choice, not demonstrated quality equivalence or physical mobile acceptance |
| Built-in model conversation template | Providers pass structured messages into SDK chat-completion APIs | Token/template/system overhead must be measured across selected models; this is not arbitrary manual concatenation of chat templates |
| Context window management | runtime.ts invokes context-budget.ts and keeps complete recent turns; default is 6144 UTF-8 bytes | Byte budget does not guarantee fitting 2048 CPU / 4096 GPU tokens with system/template/schema overhead; long-document writing still lacks accepted faithful handling |
| IndexedDB history, export, delete | Actual IDB reload/download and browser restart reports; current-source injected delete failure preserves messages and supports Enter retry | Crash/power loss, eviction, storage conflicts and physical storage failures are not universally certified |
| Compact IM design, no preview cards | Current native editor probes report zero previews; readable model identity and ready empty-state improvements | Physical mobile/accessibility coverage and full design acceptance remain incomplete |
| Progress, current engine/model/speed | Current DOM trace proves GPU preparing -> CPU preparing -> CPU ready with exact titles | Warm-cache fallback does not prove percentage reset after partial download; timings are isolated samples, not benchmarks |
| System prompt, temperature, top_p, token settings | generation-controls.ts exposes all four; local provider forwards generation settings | Dedicated structured writing intentionally uses its task profile; settings do not imply writing fidelity or user-prompt compliance |
| Word/Excel/PPT API operation and native Undo/Save | Existing actual three-editor Unicode Save/reopen, OOXML inspection and Excel formula dependency evidence | Arbitrary natural-language tool planning, complex formatting/shapes/formulas and broad factual writing remain unaccepted |
| XSS/CSP/privacy | Actual chat payload DOM tests and browser security cases; Worker CSP exists | public/_headers allows connect-src self https: http: blob:; full deployed parent/iframe/Worker policy and all content exits need audit |
| Unsupported device guidance and smaller models | Existing load-failed retry/model-choice guidance | Does not distinguish all unsupported device/physical memory failure conditions; no comprehensive physical device matrix |
| Optional speech, vision, RAG, WebMCP | Intentionally deferred per attachment's initial-stage boundary | Not part of initial text MVP acceptance; do not use optional feature work to hide core quality gaps |

## Next priorities

1. Diagnose factual-writing errors that currently pass guards, using actual source/task/output comparisons and fresh examples. Preserve the requested general capability; adding refusal heuristics or changing to extractive-only output would not fulfill it. Do not adopt a model based on native edit counts.
2. Measure actual provider token/template overhead for long conversations and writing before choosing a context strategy. Preserve complete tool exchanges and avoid silent truncation of user document text.
3. Audit concrete content-bearing network requests and current deployment CSP/iframe boundaries. Narrow permissions only after identifying required model, editor, plugin and local/custom-source paths, not by assuming every HTTPS origin is necessary.
4. Refresh latest-build offline evidence when product changes are settled, then extend actual device and accessibility coverage. Avoid repeatedly retesting the same warm-cache greeting as a substitute for these requirements.

The latest full suite has 116 files / 4260 tests passing after the history focus fix; these tests do not prove the missing end-to-end quality requirements. The overall goal remains active. The prior two fallback probes establish availability and DOM identity for injected initialization failure, and do not change the model-quality decision.
