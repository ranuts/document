# PPT native selection binding before IM writes

PPT tool targets previously captured the page and selected slides, but not the selected drawing objects or text selection. A native/programmatic selection change during model planning could leave the page, document history and DOM interaction revision unchanged, so the old target remained current. This is insufficient for selected-text replacement integration.

`captureDocumentToolTarget` now captures the native controller, selected object references and target document-content identity. It serializes the content's `GetSelectionState()` alongside the slide/page state. Execution checks the same controller, object references, text content and logical selection position before calling a tool. A formerly unavailable object list becoming available also expires the target. When active text exists but its selection state cannot be read, writes are blocked while stable read-only access remains available.

Selection checks are separate from document identity, so verification after a legitimate write is not required to retain the old selection. No preview, confirmation or UI control is added. Existing document/history/read-only/interaction checks remain in force.

## Evidence

Six new target regressions were verified failing before implementation: different selected object, content identity, logical text position, controller identity, previously unavailable object list, and unreadable active text selection. The first five exercise changes without native history or DOM events; the last proves writes are blocked but read access is retained. All 21 target tests pass. Full verification: 111 files / 4012 tests, production build and lint pass. Independent review found no important issue.

[Healthy actual IM control](2026-10-03-ppt-selection-binding-control.json) uses real local Qwen3 1.7B and production Chromium. Reading preserves the existing emoji title; adding supplied Unicode/tab/multiline/boundary-space text remains exact, preserves the original shape snapshots and supports exact Undo/Redo. `allPassed` is true, with no visible errors or preview card.

[Native selected-shape switch](2026-10-03-ppt-selection-binding-shape.json) and [native text-cursor movement](2026-10-03-ppt-selection-binding-cursor.json) occur while the IM input is disabled for real model generation. They use native API selection changes without document edits or synthetic DOM interactions. The pending write is declined as expired. Exact document snapshots, native history index, point references and item references remain unchanged; no page error occurs. Their `staleRejectionPassed` fields are true. Their ordinary write `allPassed` fields deliberately remain false, because no write should occur.

The reports establish these simple title-shape and text-cursor cases only. Groups, charts, special numbering selections, complex selection serialization and other device runtimes need separate validation. This change does not expose a PPT replacement tool yet: native selected text capture, guarded paste/history/cancellation, exact replacement verification, formatting/geometry and save/reopen still need integration and validation. The broader goal remains active.
