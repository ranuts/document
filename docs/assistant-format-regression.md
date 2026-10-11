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
