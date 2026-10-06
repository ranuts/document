# Readable model status

The compact desktop status previously displayed the raw MLC artifact ID. Known catalog models now use their existing picker label, for example WebGPU · Qwen3 · 1.7B. Retain the exact selected ID in the status title; custom IDs outside the catalog keep their original text. CPU model filenames stay unchanged. No model selection, quantization, source URL or inference behavior changes. Reset clears the old title.

Two regression cases failed before implementation: catalog label plus exact ID, and custom ID preservation. Build passed before tests. Full suite: 116 files / 4259 tests passed, with existing rejection-handled warnings. Source lint excluding existing .scratch vendor copies, TypeScript and Docker config passed.

Actual Chromium/native Chinese Word with cached Qwen WebGPU confirmed text WebGPU · Qwen3 · 1.7B and title Qwen3-1.7B-q4f16_1-MLC. Screenshot /private/tmp/im-model-label-desktop.png was inspected at 1280×900; status is readable and existing actions remain intact. Browser closed. This does not certify physical mobile/all themes or screen-reader discovery of titles. Complete custom-model identity is still available in settings.

Historical reports that captured the old visible engine string remain valid for their historical builds. Future probes must distinguish readable labels from exact Worker model identity; a friendly label alone is not sufficient model validation. Multilingual writing quality remains open.
