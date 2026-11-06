# Read-only embed export (#307)

## Symptom

Opening `/editor?src=…&readonly=1&embed=1` left File → Download clickable. The
console logged `[OO] file stream received`, but no download started. Calling
`document:save` from the parent failed with `Current document is readonly`.

## Root cause

Two independent policies collided:

1. `routeSavedFile` dropped orphan streams in embed mode and told the host to
   use `document:save`.
2. `requestSaveDocument` rejected every call while `getReadonlyMode()` was
   true.

Read-only chrome intentionally keeps the File tab (download / print / info),
so the control looked live and then did nothing.

## Fix

- Export is allowed on a locked document: `requestSaveDocument` no longer
  checks read-only. Autosave still skips read-only sessions.
- Orphan File-tab streams in embed mode call `saveFileToDisk` without clearing
  the host's dirty flag (the parent has not received `document:saved`).
- Pending `document:save` requests still take the stream first.

## Reverse check

With the read-only reject restored, the unit test
`allows export when the document is readonly (#307)` fails (no
`asc_DownloadAs`). With the embed early-return restored, File-tab downloads
inside an iframe produce the stream log and no file again.
