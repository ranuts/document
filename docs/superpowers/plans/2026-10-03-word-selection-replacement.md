# Repair Word selection replacement

Actual production IM Qwen3-1.7B Chinese exact replacement returns correct replace_selection/text, then throws TypeError: this.ReplaceTextSmart is not a function. Text remains unchanged. Bundled plugin wrapper exists but its native implementation is absent.

Use existing escaped plain-text-to-HTML conversion and pluginMethod_PasteHtml, which replaces a current selection. Require nonempty replacement and a nonempty selected string before calling it; whitespace selections remain valid. Keep existing DocumentToolAction exact text verification and native Undo. Do not add preview/confirmation, shim missing SDK internals or claim broad formatting preservation.

1. Replace mock-only Smart API assertions with regressions for supported paste, escaped multiline/whitespace and missing selection.
2. Implement and run relevant tests.
3. Build, then run full tests and lint against stable built package outputs.
4. Retest real Chinese exact replacement, neighboring text, native Undo/Redo and review scope.
