# Main-view model loading controls

Moved the existing loading progress and Stop controls into a compact row below the IM header. Settings remain collapsed; no duplicate controls, preview cards, or confirmation steps were added. Stopping preserves the editable draft and returns focus to the composer. Readiness still controls sending.

GPU-to-CPU fallback resets progress and ignores stale GPU callbacks. CPU file bytes reaching 100% do not mean that native model initialization is complete: the row returns to indeterminate Preparing until the engine is ready. The initial CPU diagnostic is retained separately. Regression tests failed before both fixes and passed afterward.

## Verification

- Final build and root lint passed. Full suite: 115 files, 4082 tests passed; focused loading coverage: 44 tests. Existing converter PromiseRejectionHandledWarning messages remain.
- Code review found no important issues after the fallback and file-completion fixes.
- Actual cached GPU 1.7B and CPU 0.6B Worker initialization was held while inspecting 1280×900, 390×844, 390×420, and 320×320 viewports. Settings stayed collapsed, Stop remained reachable, progress was visible, and the draft remained editable while Send was disabled.
- Main-view Stop terminated native Workers, preserved the exact draft, restored composer focus, and ignored released late messages. Explicit retry completed actual initialization; both engines answered Hello. No page errors, visible errors, or preview cards were recorded.
- GPU initialization emitted 31 progress samples through 1. Cached CPU initialization stayed indeterminate after file reading completed. Final desktop GPU and short-viewport CPU screenshots were visually inspected.

The archived probe and SHA-256 are recorded in each final report. These checks cover cached initialization, not first network-download byte progress, physical mobile devices, partially received response cancellation, or broad model writing quality. The overall local-AI goal remains open.
