# Native editor dynamic compilation dependencies

The actual fresh DOCX, XLSX and PPTX startup probe completed under current preview host policies. The observer recorded respectively 242, 233 and 187 `Function` calls, with no page errors. This is startup compatibility evidence with instrumentation, not a Save, AI-tool, offline or security acceptance result.

## Source correlation

The first recorded constructor call in each editor has a 42-character body. Its stack points to `public/sdkjs/word/sdk-all-min.js:2194`, `public/sdkjs/cell/sdk-all-min.js:2346` and `public/sdkjs/slide/sdk-all-min.js:2226`. Each current source line constructs a function whose body invokes `eval` on a strict-mode-prefixed `value`. The constructor parameters include `Function`, `Api`, `window`, `document`, `XMLHttpRequest` and `globalThis`. The surrounding code exposes `CDocumentMacros`, `VbaProject` and `safePluginEval`.

This establishes an additional SDK dynamic-compilation dependency during startup. It does **not** establish that a macro was executed, that the function provides a security sandbox, or that the IM tool dispatcher invokes it. Removing this dependency requires inspecting its callers and supported macro/plugin behavior rather than deleting the constructor blindly.

Further captured calls originate in the editor application's `it.template` implementation. Template precompilation alone therefore cannot remove all startup constructor calls. The earlier enforced no-unsafe-eval experiment remains incompatible with these native editors.

## Probe limits and next action

The isolated Chromium context blocks service workers. An init script wraps `window.Function` only in child frames, forwarding calls and construction with `Reflect`. It records stack traces and generated-body lengths, never generated-body text, and leaves `eval` untouched to preserve its lexical semantics. This instrumentation still changes the global constructor identity; uninstrumented behavior must be verified separately before shipping any replacement.

Total counts include every observed constructor call. Only the first 40 unique stack sites are retained; their counts are not a complete site census. The report retains the observed first 40 sites, not proof of all possible document/plugin execution paths.

No vendor bundle or production policy was changed. The next policy experiment must distinguish permitted legacy dynamic compilation from external script loading and event attributes, then verify native edit, Undo, Save and reopen. It must not relax the shell or model Worker policies.

Artifacts: [probe](probe-vendor-function-dependencies.mjs), [observations](2026-10-03-vendor-function-dependencies.json), [source/evidence checker](verify-vendor-function-dependencies.py). Run the probe against the built preview at port 5193 with `node docs/evaluations/probe-vendor-function-dependencies.mjs`.
