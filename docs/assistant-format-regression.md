# Supported-format regression — 2026-10-11

## Coverage

The real editor regression covers all 13 accepted extensions:

- Word: DOCX, DOC, ODT, RTF, TXT.
- Spreadsheet: XLSX, XLS, ODS, CSV.
- Presentation: PPTX, PPT, ODP.
- PDF: native annotation, save/reopen and read-only protection.

Thirty end-to-end cases passed: 27 format/product/agent cases and three real
legacy Office samples from Apache POI. Legacy samples exercise open, OOXML
conversion, PDF export and read-only behavior. TXT/RTF tests additionally check
that text survives native save and reopen. Agent cases check review before
writing, native Undo, cancellation, and Word/spreadsheet/presentation writes.
Nine PDF/agent cases were rerun after the final PDF capability correction.

Full unit regression: 161 files, 4,861 tests passed. Type checking, archive-aware
lint, formatting and the production build passed. Added source lines and new
files contain no absolute user paths or private user names.

## Repairs found during regression

- Ground chat in fresh editor content, distinguishing an empty readable scope,
  an unavailable read, and truncated content. The previous empty-sheet prompt
  fabricated cells; the same prompt now reports the empty spreadsheet.
- Identify PDF using the engine's native `isPdfEditor()` discriminator, rather
  than treating it as a Word editor or inferring type from annotation methods.
  PDF annotation APIs remain separate from AI Word body actions.
- Update obsolete end-to-end selectors to the current settings/history toggles
  and natural-language request flow. Review tests explicitly assert that cells
  remain unchanged until approval; cancellation uses the visible controls.

## Actual default-model checks

Qwen3 1.7B with WebGPU was tested separately from mocked provider tests:

- Word: empty content read; short prose generation; insert generated body;
  independent native body read; one Undo; fresh empty-content read.
- XLSX: empty content read; read a range and propose a numeric cell write;
  apply the proposal; fresh read returns the actual value; native Undo.
- PPTX: empty content read; propose and apply a text box; read returns the exact
  requested text; one Undo; fresh read reports no readable text.
- CSV: read all six cells in a synthetic A1:B3 range; change occupied B2 from
  7 to 9 after review; exported CSV contains 9; one Undo restores exported 7.
- The loaded model remains ready across same-page editor switches. A page reload
  still requires recreating the in-memory engine from cached files.

## Limits

Passing these cases establishes the tested integration paths, not reliability
for arbitrary documents or arbitrary natural-language instructions. The small
default model still misroutes some paraphrased requests; it remains experimental.
Complex file fidelity, seven-language model quality, and live microphone quality
require separate acceptance datasets. Unsupported PDF AI edits must not be
reported as successful operations. Success is based on native state or exported
content, never solely on the assistant's completion text.

## HITL follow-up

- Review proposals stay in chronological chat order. Insert, replacement and
  clear actions use their actual operation labels. Clear shows the captured body
  character count and expandable original text, without a meaningless Copy action.
- Pending, applying, expired, failed, sent and verified states are explicit.
  Completed proposals collapse to one status; Apply, Copy and Cancel disappear.
  Repeated confirmation cannot execute the operation twice. Cancel while applying
  aborts the operation. Settling a focused proposal restores the preceding focus.
- Completion feedback is not repeated as a second chat activity. Seven shipped
  locales include the new labels; source is rendered as text, never HTML.
- Regression: 4,863 unit cases passed; 10 product/editor end-to-end cases passed.
  The final six editor-write cases passed again after the last changes. Type
  checking, formatting, privacy scan and production build passed.
- Real Qwen3 1.7B: clear a Word body after confirmation, independently verify an
  empty body, then send 你好 and receive a normal greeting. Switch to CSV with the
  same loaded model, change occupied B2 to 9 after review, independently export
  the updated CSV, then send 你好 and receive a normal greeting again.
- Native editor Undo remains the recovery mechanism. A dedicated action-owned
  Undo button and rich editor-inline diffs are not introduced by this follow-up.

## PDF assistant follow-up

The assistant now reads selectable text on the current PDF page and can propose a page note for review. It identifies the page being read and does not claim to have read the whole file. Scanned image text is unavailable. Notes are attached to pages and do not replace body text; selected-text transformations are shown as copyable replies.

Cancellation leaves the file unchanged. Confirmed notes can be undone in the editor and survive saving and reopening. An injected failure after adding a note is rolled back, and the next note can still be added and undone. The desktop PDF editor exposes the same assistant entry on its existing left toolbar.

Updated ordinary-user guidance is available in the seven localized assistant and help pages, with matching README summaries. Model interpretation quality remains a separate acceptance requirement.

Final verification: 165 unit files and 4,915 tests passed. Type checking, lint, formatting and the production build passed. The final PDF editor run also verified a note on the second page, one-step Undo and persistence after saving and reopening. These controlled-response checks verify editor behavior, not the default model’s interpretation quality.

## Imported assistant formats

A new real-editor suite covers ODT, ODS, ODP, RTF and TXT using shared synthetic, non-private fixtures. Each case opens through the product file picker, verifies that the service receives the imported content as request context, waits for review without changing the file, confirms one native edit, reads the result independently and restores the original content with one native Undo. These checks cover the application contract with controlled service responses, not model interpretation quality.

All five assistant cases passed. Together with existing OpenDocument/text save and PDF export cases and picker coverage, the final run passed 11 tests. The initial ODS failure was a test-provider parameter mismatch (`address` instead of the schema's `cell`), verified in the captured response; the application rejected it without changing the cell. Corrected the fixture response and reran the complete set successfully.

DOC, XLS and PPT acceptance now uses genuine public legacy binary files. DOC insertion and XLS cell replacement pass review, native readback and one-step Undo. The PPT fixture has reserved title/body/footer regions: adding another box correctly fails for lack of room and rolls back, then editing the selected existing title succeeds after review and one Undo restores it. This does not imply arbitrary new text fits every slide. The opt-in corpus suite is not evidence of a pass when no corpus has been supplied.

### Reproducing the public legacy run

The legacy assistant cases use public LibreOffice regression files at pinned revision `63a2e191551b157adad367d020835e9ec21fc964`:

- [Word zoom.doc](https://github.com/LibreOffice/core/blob/63a2e191551b157adad367d020835e9ec21fc964/sw/qa/extras/ww8export/data/zoom.doc)
- [Spreadsheet universal-content.xls](https://github.com/LibreOffice/core/blob/63a2e191551b157adad367d020835e9ec21fc964/sc/qa/unit/data/xls/universal-content.xls)
- [Presentation tdf49561.ppt](https://github.com/LibreOffice/core/blob/63a2e191551b157adad367d020835e9ec21fc964/sd/qa/unit/data/ppt/tdf49561.ppt)

Download verification checks exact byte size, compound-file signature and SHA-256. Downloaded binaries remain in an ignored test output directory, not the repository. No private corpus is needed.

```sh
node bin/fetch-agent-legacy-fixtures.mjs
LEGACY_AGENT_CORPUS_DIR=test-results-legacy-fixtures pnpm exec playwright test test/e2e/agent-imported-formats.spec.ts --workers=1
CORPUS_DIR=test-results-legacy-fixtures CORPUS_DEEP=1 pnpm exec playwright test test/e2e/corpus.spec.ts --workers=1
```

Without the explicit corpus directory, the three legacy assistant cases are reported as skipped. They must not be counted as verified by the default suite. These representative files establish basic format-specific acceptance; they do not certify every legacy layout or every model's decisions.

The public legacy corpus run also passed three files with no findings, covering import, save, trusted editing, PDF export and read-only behavior. The first PPT test mixed multi-line native text with rendered paragraph text; its marker now uses the first native text line. A subsequent insertion attempt correctly rolled back because reserved boxes left no free area. The final PPT case checks that failure explicitly and then verifies a real selected-title edit and Undo. No product code was weakened to make a crowded insertion pass.

Final current-code imported assistant run: all eight cases passed with the explicit public corpus, including the legacy PPT insertion rollback followed by reviewed title replacement and exact Undo. No skipped legacy cases were counted. Targeted lint, formatting and diff checks passed; added-content privacy scan found zero local-path, username or token-shaped-secret matches.
