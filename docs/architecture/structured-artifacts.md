# Structured artifact boundary

Artifacts remain explicit local saves, independent of conversation retention. Ordinary chat saves remain text. **Import structured result** accepts an explicit JSON envelope from a result the user chooses to import:

```json
{ "schemaVersion": 1, "payload": { "kind": "table", "columns": ["Name"], "rows": [["Value"]] } }
```

A slides payload uses `{"kind":"slides","slides":[{"title":"Title","body":"Body"}]}`. A text payload uses `{"kind":"text","text":"Content"}`. Unknown schemas, fields, non-string values, sparse arrays and inconsistent row widths are rejected. Tables allow at most 50 columns, 500 rows and 10,000 cells. Slides allow 50 slides. Each structured field allows 16 KiB UTF-8; serialized payloads allow 128 KiB. Legacy plain-text versions retain their full 128 KiB capacity. Artifact/version counts remain 50/20; no saved history is silently pruned.

`artifacts/payload.ts` owns validation and canonical text. The store validates before transactions and validates records again on read, stores copies, preserves provenance and atomically checks expected versions. `ui/artifact-presentation.ts` owns a ten-row editable table page or one editable slide. A collapsed JSON source disclosure retains the existing text draft capture boundary. Editing a field synchronizes canonical source without replacing the active input or caret. Malformed source remains editable; saving and exporting are blocked until repaired.

Text refinements preserve existing selected-range behavior. Structured refinements target the whole payload, require the same kind and bounded schema, validate before showing an actionable proposal and validate again before acceptance. Acceptance changes the draft only; saving a version remains explicit. Document/source/provider freshness guards continue to apply.

TXT, Markdown, CSV and JSON exports are explicit browser Blob downloads and work offline without a model or network call. CSV is available for tables only, quotes every value and neutralizes formula-like prefixes, including control/whitespace prefixes, without changing stored data or JSON. Previews only use text and native form fields, never generated HTML or JavaScript.

Structured data is not directly applied to Office documents: there is no verified atomic table-range write contract yet, and artifact fields can exceed native slide limits. The interface explains the export path instead of silently truncating, emitting cell-by-cell writes, or exporting the unrelated current document. Existing text-to-Word application still uses fresh document review.
