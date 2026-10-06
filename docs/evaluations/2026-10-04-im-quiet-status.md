# Concise IM status verification

The main IM status now shows decode speed alone. Existing first-text, first-token,
overall response rate and token-count details remain in collapsed advanced
generation settings. The default CPU model displays `CPU · Qwen3 · 0.6B`, with
the exact GGUF filename in its title. Custom model URLs preserve their identity.

The regression tests failed as expected before implementation. After the final
change, all 128 test files / 4,376 tests, TypeScript checking, focused linting and
the production build passed. Existing promise-rejection warnings and build
externalization/chunk-size warnings remain. Read-only review found no blockers.

`probe-im-quiet-status.mjs` is a byte-identical copy of the executed browser
probe. `2026-10-04-im-quiet-status.json` preserves its final recorded result.
The probe used the production preview, disabled WebGPU to exercise automatic
CPU fallback, and submitted a real chat request. It checked collapsed detailed
statistics, the model label/title, zero preview cards, and composer visibility
at 390 × 550. The owned browser context was closed afterward.

This is UI evidence, not a model-quality or speed benchmark, a physical-mobile
test, or certification of cold offline/PWA behavior. Model fidelity remains an
independent unresolved requirement. No inference or document-write behavior
changed in this UI update.
