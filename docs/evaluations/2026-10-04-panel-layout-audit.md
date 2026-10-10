# IM layout audit — 2026-10-04

Observed current production bundle through the existing local preview at port 5193. Fresh owned Playwright Chromium context, service workers blocked, synthetic blank Word document, no user documents. Product revision and plugin byte hashes are recorded in JSON. This is an appearance/keyboard audit, not model, native save, offline, deployed hosting, or physical mobile acceptance.

## Coverage and measured outcome

40 samples: 1280/768/480/375/320 CSS px widths × 800/400 CSS px heights × emulated light/dark system preferences × settings closed/open. Every sample has equal panel client/scroll width and equal root client/scroll width. Every composer input lies inside the viewport vertically. All 20 settings-open samples close with Escape and return focus to the settings button. No page errors were recorded. Dark short-window and light desktop screenshots were visually inspected; the site responds to the emulated dark preference.

The driver suppresses selected model Worker initialization messages to retain a loading layout. It does not record whether every initialization was intercepted; this report makes no inference, network privacy, Stop/Retry or download timing claim. The observed state was preparing the WebGPU Qwen3 1.7B model. Emulated dimensions/preferences do not establish physical mobile keyboard or native Safari behavior.

## Design findings and next implementation scope

The compact main surface has a persistent input, task selector, document context, progress and Stop; no document preview cards are required. At desktop height, expanding settings leaves a very short conversation region and clips the empty-state heading inside that scrollable region. At 400px height, the conversation disappears while the composer remains visible, which prioritizes input but provides little context during loading.

Advanced custom model ID, model directory and WASM URL currently occupy the settings home surface, above the response settings. They should move together behind one optional advanced disclosure; provider/model/load and familiar response controls should remain straightforward. This is a diagnosed simplification opportunity, not an implemented change or claim that settings are unusable.

Next verify this with fresh UI reproduction and implement a compact settings hierarchy, then check keyboard focus, CPU/GPU field visibility, custom model persistence, short/narrow windows, load cancellation and actual inference. Existing model semantic failures remain independent of this layout work.

Screenshots remain in `.scratch/ai-panel-audit/`; the JSON records their hashes but these scratch images are not durable repository artifacts. The reusable driver only changes the observed scratch driver's report destination and creates the scratch directory; the recorded observed driver hash identifies the exact executed source.
