# Word Unicode and tab readback

Actual production IM replacement writes supplementary Unicode correctly, but native `GetText` truncates the code point. The [original tracked diagnostic](2026-10-03-word-im-tracked-unicode-diagnostic.json) captures canonical `😀` versus native `U+F600`: exact replacement, neighboring text and native Undo/Redo pass, yet IM displays a verification error. Its overall false result remains preserved.

The correction reads native main-document text items using the existing shared plain-text decoder. Native runs preserve Unicode scalar values, tabs and paragraph/soft breaks; revision snapshots retain their existing review-type and selected-position rules. Both document-tool and writing-action verification use the corrected body readback. Unknown native structures fail validation before main-body editing; an unknown post-edit read cannot be interpreted as empty successful output. Legacy adapters without native paragraph/run information retain their existing getter path.

Selection getters now explicitly preserve `TabSymbol: '\t'` and disable generated numbering. Independent review found the mismatch between default selection getters and canonical tabs; the two target regressions cover that correction. The runtime plugin wrapper was inspected and confirms it forwards these options to native selection reading. Word selection tools and context use the same options. No preview, confirmation, UI control or document-save workflow was added.

## Actual production IM evidence

All recorded successful cases run real cached Qwen3 1.7B WebGPU planning with Chinese exact-replacement commands, replacing text with `项目 😀 Payment · NOT approved`:

| Native mode / selection | Report |
| --- | --- |
| Track revisions enabled / `Alpha` | [report](2026-10-03-word-im-tracked-unicode-fixed.json) |
| Track revisions enabled / `A😀pha` | [report](2026-10-03-word-im-tracked-unicode-selection-fixed.json) |
| Track revisions disabled / `A😀pha` | [report](2026-10-03-word-im-plain-unicode-selection-fixed.json) |
| Track revisions enabled / `A😀pha\t` | [report](2026-10-03-word-im-tracked-tab-selection-fixed.json) |
| Track revisions disabled / `A😀pha\t` | [report](2026-10-03-word-im-plain-tab-selection-fixed.json) |

The independent probe decodes native code points and captures raw SDK text separately. It checks exact canonical text, unchanged second paragraph, native review types and native Undo/Redo snapshots, and no visible errors or page errors. Tracked cases retain deleted original text and add the replacement as inserted revisions. Plain cases replace the original selection. Reports record the actual engine and production bundle URL. Initial [setup diagnostic](2026-10-03-word-im-plain-unicode-selection-setup-diagnostic.json) failed because the probe inspected asynchronous native seed paste too early; corrected selection probes wait for native seed completion before selecting or editing.

Production build, 113 test files / 4040 tests, and repository lint pass. Five new regression tests were added. The suite retains the previously investigated asynchronous rejection-handled warnings in converter-loading tests. Independent review of the final selection/readback correction found no Important or Critical issues.

## Limits

This verifies the recorded plain main-body paragraphs, Unicode/tab selections and character review types. Main-document paragraph enumeration can include drawing paragraphs and flatten table paragraphs; these checks do not establish drawing/table structure or boundary preservation. Unknown native items are rejected. Headers, footers, comments, complete styles, bookmark/link metadata, revision author/date, accepting/rejecting revisions, Save/reopen, every configured model and physical mobile behavior remain separate validation work. The broader local-AI goal remains active.

## Coverage across configured text runtimes

The [validated matrix](2026-10-03-word-unicode-model-matrix.json) covers four configured WebGPU models (Qwen3 1.7B, Qwen3.5 0.8B, Qwen3.5 2B, Qwen3 4B) and the Qwen3 0.6B GGUF CPU fallback, each in plain and tracked modes. All ten cases pass. The eight new reports are linked by filename in the matrix and contain detailed native snapshots; the two existing 1.7B reports remain unchanged.

Each case selects `A😀pha\t` and uses a Chinese literal replacement command containing another emoji and `NOT approved`. In addition to exact text, unchanged neighboring paragraph, native Undo/Redo and no visible errors/previews, the matrix independently checks the entire first paragraph's character/review-type sequence: six selected native characters retained as type 1 in tracked mode, exact replacement characters as type 2, and unchanged outside characters/review types. Plain replacement uses normal type 0 and removes the selection. The historical 1.7B snapshots pass the same independent comparison. Matrix entries record SHA-256 hashes of each detailed report; new reports also record the actual probe source hash.

Actual engine labels are checked during the new probes; WebKit CPU probes disable WebGPU and require the CPU engine. Native seed paste is awaited before selecting. These are cached-model desktop runs, not physical mobile or cold/offline-start evidence. CPU generation took approximately 32–33 seconds in these two observations; this is not a benchmark. Repository lint passes. This follow-up changes no production code, so the preceding build and 4040-test verification applies. Save/reopen, full revision metadata, all cancellation timings, drawing/table boundaries and physical devices remain separate work.
