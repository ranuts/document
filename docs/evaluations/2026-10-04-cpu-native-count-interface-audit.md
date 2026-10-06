# Installed CPU SDK count interface audit

The installed patched `@wllama/wllama` 3.6.1 does not expose a count-only native action. Its C++ dispatcher accepts exactly load, completion, embedding, rerank, get_result, cancel and test_backend_ops. The declaration provides `getChatTemplate()` as a metadata getter, not a complete-message tokenizer.

`create_completion_task` applies `oaicompat_chat_params_parse` using loaded model chat parameters, then posts a `SERVER_TASK_TYPE_COMPLETION` task. The public completion wrapper forwards options through the completion action. Thus accessing the existing private proxy cannot reveal an unexposed token-count action in this installed runtime. The earlier actual zero-limit call also generated text.

Accurate preflight requires a native extension that uses the same model vocabulary and template parser as generation, counts the resulting full prompt without posting a generation task, and returns the effective context capacity. It must include system instructions, tool/schema overhead, special tokens and output reservation. A separate JavaScript template implementation or raw string token count would require equivalence evidence before adoption. Embedding is not a substitute: it has different input/template semantics and performs model work.

Next feasibility gate: determine whether a reproducible WASM build and matching native template/tokenization APIs are available, then prototype count-only behavior before changing production. This audit does not prove such an extension is implemented or portable, and does not assess newer upstream releases. Existing context overflow recovery remains necessary.

The [source hash snapshot](2026-10-04-cpu-native-count-interface-audit.json) binds this finding to five installed files; the dispatch enumeration and parser/task markers were checked directly. [Runtime zero-limit evidence](2026-10-04-cpu-zero-token-limit-diagnostic.md) is separate. No production code or UI change.
