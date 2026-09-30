# Telling the embedding page when a document has unsaved edits

2026-09-30

## What changed

The embed API now reports the unsaved-changes flag the app already kept for its
own `beforeunload` guard (`lib/unsaved-guard.ts`):

- `document:dirty-changed` `{ dirty }` is pushed to the parent whenever the flag
  flips;
- `document:state` and `document:saved` carry `dirty`.

A host that stores documents itself (the usual embed setup: the parent owns
auth and storage, the iframe only edits) can now save when the user switches
documents or on a timer, without exporting -- and uploading -- documents nobody
touched. Before this, the only safe policy was "export on every switch", which
costs a full x2t conversion each time.

## The part that was not just plumbing

Relaying the flag was not enough. The SDK derives "modified" from its undo
history (`History.Index !== History.SavedIndex`) and `onDocumentStateChange`
fires only when that answer flips. With serverless saves (guard 5) nothing ever
moves `SavedIndex`, so:

1. first edit -> `onDocumentStateChange(true)` -> dirty;
2. host saves -> the app clears its flag;
3. second edit -> the SDK still thinks the document was modified all along ->
   **no event** -> the flag stays clean and the host never saves that edit.

The new e2e spec (`test/e2e/embed-dirty-state.spec.ts`) fails exactly at step 3
for docx, xlsx and pptx when step 2 only clears the app flag.

The fix does after an embed save what every editor (word, cell, slide) does in
its own save callback: `AscCommon.History.Reset_SavedIndex(true)` followed by
`Asc.editor.CheckChangedDocument()`. That puts the SDK back in the "clean"
state, so the next edit flips it again and fires the event.
(`lib/onlyoffice/save-point.ts`)

## Edits made during the export

An export takes seconds on a large document, and the user can keep typing. Those
edits are not in the bytes the host receives, so marking them saved would lose
them. The save point is captured before `requestSaveDocument` starts and only
committed if the history is still there afterwards: same `Index` **and** the
same head point object. Comparing the index alone is not enough, since undo
followed by a new edit lands on the same index with different content.

When the history moved, nothing is committed: the document stays dirty and
`document:saved` says `dirty: true`, so the host knows to save again.

## Deliberately left alone

- `returnOriginalOnTimeout` saves never clear the flag: the file the host gets
  on timeout may be the original, and the request cannot tell which it was.
- Standalone saves to disk have the same step-3 problem (after a save, a later
  edit does not re-arm the `beforeunload` guard or the autosave). The same
  save-point pair would fix it, but the export there is triggered from several
  places (toolbar, Ctrl+S through guard 5, the history layer), so it is left for
  a separate change rather than folded into this one.
