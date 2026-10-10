# PPT replacement: Save/reopen validation and font metadata diagnostic

The actual production IM replacement path can save a nonempty PPTX through the visible native Save button and reopen that download using the homepage file chooser. This evaluation uses Qwen3 1.7B and a title text box containing `Alpha Alpha`, with the first `Alpha` made bold. IM replaces the second occurrence with `项目 😀\tPayment\n  NOT approved  `.

This is **not a fully passing formatting/metadata roundtrip**. The reports keep `allPassed: false` and retain the exact differences.

## Verified behavior

[Final IM report](2026-10-03-ppt-selection-replacement-save-reopen.json) proves:

- Exact saved/reopened text, including emoji, tab, line break and boundary spaces.
- Unchanged bold prefix, other shapes and the tested visible-character style fields.
- Exact native Undo/Redo snapshots for the IM replacement before reopening.
- Reopened shape bounds within 0.001 mm of their original coordinates.
- The inserted Chinese character `字` at the first line's end has the same tested style before Save and after reopening. Tested visible characters in these typing probes also match.
- No visible IM errors, preview cards or page errors. Native Save downloads a roughly 34 KB PPTX.

The final snapshot reader does not call Recalculate. It checks native history index, point identities and item identities around each read and throws if reading changes history. The report records the probe source and saved-file SHA-256 hashes. [Initial diagnostic](2026-10-03-ppt-selection-replacement-save-reopen-diagnostic.json) retains the original unsuccessful full-character-style comparison.

## Remaining difference and no-AI control

The sampled character-style comparison differs at the first paragraph's end marker: its effective EastAsia font changes from `Arial` to `等线 Light`. This marker has no visible glyph. The saved first `a:endParaRPr` contains `a:latin` and `a:cs` for `等线 Light`, but no `a:ea`. The reports do not treat that as proof of either correct or incorrect complete metadata preservation.

[No-AI native control](2026-10-03-ppt-native-selection-save-reopen-control.json) uses direct native `asc_PasteData` with the same text and bold setup, then native Save and the same file chooser. It reproduces the mismatch without model planning or the IM tool writer. Raw and effective paragraph-end fonts show that the in-memory first end run has empty raw RFonts; after reopening it has explicit latin/HAnsi/CS font names. The recorded effective CS font also changes from `Arial` to `等线 Light`. The source is therefore narrowed to native paste/font inheritance or Save/reopen conversion, rather than altered model text.

Independent review confirms that the tested text, bounds and visible styles match, that the inserted Chinese character matches, and that these snapshots are insufficient to claim complete formatting or metadata preservation. They sample bold, italic, underline, font size, and latin/EastAsia font names; they do not prove colors, language, complete theme inheritance, spacing, links or bookmarks.

No product code was changed in this evaluation. Lint passes. The previous 4030-test production verification remains applicable to the unchanged implementation; this turn adds actual native Save/reopen and no-AI evidence instead of another identical unit-test run.

Next investigation: compare the native paragraph-end compiled-font resolution with the saved/reopened theme inheritance and determine whether the newly inserted paragraph end needs explicit inherited fonts inside the owned paste history transaction. Any correction must preserve Undo/Redo and neighboring styles and then pass the complete comparison; the current metadata failure remains open. No OS-level overwrite, external PowerPoint, offline reopening, grouped shapes or complete style preservation is claimed here.

## Follow-up correction

The earlier failing reports above remain unchanged. The [corrected production IM report](2026-10-03-ppt-selection-replacement-save-reopen-fixed.json) passes the complete sampled character-style comparison, boundary typing, exact text, neighboring content, shape bounds and native Undo/Redo. The correction materializes the existing effective font properties in `Paragraph.TextPr` for paragraph separators introduced by the replacement, inside the same native undo transaction. Original paragraph ends outside the inserted payload are left alone. It adds no preview, confirmation or separate save workflow.

Native feasibility probes distinguish the serializer owner: [setting the end run](2026-10-03-ppt-native-paragraph-end-font-explicit-probe.json) failed; [setting paragraph TextPr](2026-10-03-ppt-native-paragraph-textpr-font-explicit-probe.json) preserved the sampled saved fonts. Those standalone probes are diagnostics, not successful IM transactions: their overall results remain false.

Verification for the correction: production build, 112 test files / 4035 tests and repository lint pass. The test suite still prints the previously investigated asynchronous rejection-handled warnings in converter loading tests. [Actual IM Stop regression](2026-10-03-ppt-selection-replacement-im-stop-font-fixed.json) passes cancellation, earlier redo preservation, late preparation suppression, and the next replacement. These results cover the recorded text box and sampled styles; they do not establish complete theme/style metadata preservation, external PowerPoint compatibility or physical mobile behavior.

[Native transaction regression](2026-10-03-ppt-replacement-native-font-fixed.json) passes normal emoji/tab and multiline replacements, cancellation with prior redo, preservation of intervening edits, independent Undo/Redo and subsequent replacement. Independent code review found no Important or Critical issues.

## Save/reopen coverage across configured models

The corrected production build now passes the same actual IM native Save/download/reopen scenario with all configured text runtimes:

| Actual engine | Report |
| --- | --- |
| Qwen3 1.7B WebGPU | [report](2026-10-03-ppt-selection-replacement-save-reopen-fixed.json) |
| Qwen3.5 0.8B WebGPU | [report](2026-10-03-ppt-selection-replacement-save-reopen-0_8.json) |
| Qwen3.5 2B WebGPU | [report](2026-10-03-ppt-selection-replacement-save-reopen-2b.json) |
| Qwen3 4B WebGPU | [report](2026-10-03-ppt-selection-replacement-save-reopen-4b.json) |
| Qwen3 0.6B GGUF / WebKit CPU | [report](2026-10-03-ppt-selection-replacement-save-reopen-cpu.json) |

The four new runs use English literal replacement commands containing Chinese text, emoji, tab, newline and boundary spaces. All preserve the existing bold prefix, other text boxes, exact native Undo/Redo and the sampled character styles through native Save and homepage file-chooser reopening. Typing `字` at the inserted first paragraph's end has the same sampled style and document snapshot before and after reopening. Native snapshot reads also verify they did not change history point/item identities or index. No preview, additional confirmation or product behavior was added.

Each new report records the requested model, checked actual engine label, production bundle URL, probe SHA-256 and saved PPTX SHA-256. Saved artifacts are about 34 KB; their hashes were independently compared to files on disk. Models are cached in isolated desktop browser profiles. The CPU run explicitly disables WebGPU and requires the CPU engine. Repository lint passes; no production source changes required another build or unit-test run in this follow-up.

This closes all-model coverage for this specific recorded native Save scenario. It does not prove Chinese command planning for Save, OS overwrite, external PowerPoint compatibility, offline reopening, physical mobile devices, grouped shapes, table/chart text or every formatting/theme/link/bookmark property. The earlier negative diagnostic reports remain preserved.
