# Moving x2t off the editor frame: what it costs, measured

2026-09-12

Follow-up to
[2026-09-12-server-mock-already-in-vendor.md](2026-09-12-server-mock-already-in-vendor.md),
which established that `AscCommon.x2t`'s two methods are the only seam x2t
crosses and that the seam is realm-safe. This is the design work that comes
before writing it, and the measurements that decide the shape. Nothing is
implemented yet.

## The prize, and what it is not

`test/e2e/wasm-memory.spec.ts` measures the x2t heap at ~340 MB after an open
and ~408 MB after saving a 20k-row workbook. `X2TConverter.prototype.destroy`
exists but nothing calls it, and it only drops a JS reference: x2t.js is an
unwrapped classic script, so `wasmMemory` / `HEAPU8` / `wasmBinary` are
properties of the frame's `window` and survive it. In the frame, that heap is
resident for the life of the frame.

Behind something terminatable it becomes transient: pay it on open, hand it
back, pay it again on save.

It is **not** a fix for GitHub #144. The peak at open time is unchanged -- x2t
still asks for its 283 MB initial heap at the moment it instantiates, which is
the moment that fails on a browser short of memory. And a dedicated worker runs
on its own thread inside the _same_ renderer process as its document, and our
editor iframe is same-origin, so nothing gains process isolation either. The
win is lifecycle, plus taking conversion off the frame's main thread, plus
guard 10 (`guards/wasm-binary-release.ts`) becoming unnecessary.

## The measurement that was going to decide it

The suspicion was that fonts make the boundary too expensive. `convertToBin`
and `convertFromBin` both call `X2TConverter.prototype.fetchFonts`, which is a
thin wrapper over the vendor's `window.AscCommon.fetchFonts` -- and that reads
`AscFonts.g_font_infos`, which is **editor-frame state**, populated as the
document loads.

Measured by calling it directly against a live editor:

| document                                | fonts flagged NeedStyles | files written | bytes      |
| --------------------------------------- | ------------------------ | ------------- | ---------- |
| one-paragraph Latin docx, saved as docx | 5 of 202                 | 14            | 4,574,708  |
| Chinese docx, exported to PDF           | 6 of 202                 | 16            | 25,411,296 |

4.6 MB for the most trivial document there is, and 25.4 MB for a CJK PDF
export -- per conversion, and a conversion happens on every open and every
save. Shipping that across a `postMessage` boundary each time would have been a
bad trade against an idle-memory win.

**But it does not have to cross.** `fetchFonts` builds those bytes by XHR-ing
`g_font_loader.fontFilesPath + file.Id` for each flagged font and XOR-decoding
the first 32 bytes with a fixed 16-byte key. A worker can do exactly that
itself, off the same HTTP and Service Worker cache the frame would have hit.
What has to cross is the _list_ -- which fonts are flagged, their style indices
and file ids -- a few KB.

So fonts are not the blocker. They are a ~30-line piece of the worker, and one
more place that knows the XOR key (already in `bin/font-catalog.mjs` and
documented in `docs/fonts.md`).

## Shape

Frame side, as a guard: replace `AscCommon.x2t` with a proxy over the two
methods (the accessor-on-assignment trick guard 10 uses, and the one
`test/e2e/offline-seam.spec.ts` already exercises).

Nothing needs blob URLs to cross a realm. The proxy owns them on the frame
side: it reads the document's media out of `g_oDocumentUrls.urls` into bytes on
the way in, and turns the worker's returned media bytes into blob URLs on the
way out. Plain structured clone in both directions, which the seam test showed
the editor accepts.

Worker side: `importScripts('x2t.js')` with the same `Module.instantiateWasm`
streaming hook (`fetch` + `instantiateStreaming` work unchanged in a worker,
and after the brotli migration there is no decompression to port), the same
`/working/{media,fonts,themes}` FS layout, and the same `params.xml`
construction.

That last part is the real cost. `_convertDocument` in `x2t_helper.js` is not a
thin wrapper -- format codes, the `.doc`/`.xls`/`.ppt` two-step via docx, PDF
changes merging, media round-tripping, exit-code classification. Reimplementing
it in the worker means two copies that must stay in step, which is exactly the
burden the brotli change just removed from the wasm loader.

Three ways out, in order of preference:

1. **Make `x2t_helper.js` worker-safe** and load the same file in both places.
   It touches `window` and `document` in a handful of places (`loadScript`'s
   `<script>` tag, `downloadFile`'s postMessage, `fetchFonts`' vendor call).
   Each has a worker-shaped equivalent; the file is already ours.
2. Extract the conversion core into a file both sides import, leaving the
   DOM-bound parts behind. Cleaner, larger diff.
3. Reimplement in the worker and pin the two against each other with tests.
   Cheapest to write, worst to live with.

Option 1 looks right, and it is the one that keeps a single definition of what a
conversion is.

## Why this is not in the same change as the seam test

It is a day-scale change that moves every open and every save onto a new
transport, and the whole E2E suite is the acceptance test for it. The
measurements above are the part that was worth doing first, because they were
what might have killed it.

## Next

- Decide between options 1 and 2 above by reading `x2t_helper.js` for `window` /
  `document` uses.
- Worker gets its own x2t; frame proxy forwards; fonts fetched worker-side from
  a metadata list.
- Terminate on an idle timer, respawn on demand. Measure the reclaim with the
  same `HEAPU8.buffer.byteLength` probe `wasm-memory.spec.ts` uses, from the
  page rather than the frame.
- Keep `test/e2e/offline-seam.spec.ts` green throughout: it is the contract this
  rests on.
