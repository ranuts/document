# x2t converts in a worker now, and the three things that broke on the way

2026-09-12

Implements the design in
[2026-09-12-x2t-off-the-editor-frame-design.md](2026-09-12-x2t-off-the-editor-frame-design.md),
on the seam established by
[2026-09-12-server-mock-already-in-vendor.md](2026-09-12-server-mock-already-in-vendor.md).

## What changed

Every conversion — `convertToBin` on open, `convertFromBin` on save — now runs
in a dedicated worker. Guard 14 (`lib/onlyoffice/guards/x2t-worker.ts`)
replaces those two methods on `AscCommon.x2t` with a proxy;
`public/sdkjs/common/wasm/x2t/x2t.worker.js` loads **the same
`x2t_helper.js`** and drives it. The worker is created on demand and
terminated after 30 s idle.

Measured, after an open and a save:

```
editor frame     no Module at all
x2t worker       streaming: true  buffered: false  ran: true  heap: 340 MB
30 s later       the worker is gone
```

Before this, that 340 MB was resident for the life of the editor frame. x2t.js
is an unwrapped classic script, so `wasmMemory` / `HEAPU8` are properties of the
frame's global; `X2TConverter.prototype.destroy` exists, is never called, and
only clears a JS reference. There was no way to hand it back short of
destroying the frame.

**It is still not a fix for GitHub #144.** The peak at open time is unchanged:
x2t asks for its 283 MB initial heap the moment it instantiates, which is the
moment that fails on a browser short of memory. A dedicated worker also runs on
its own thread inside the _same_ renderer process as its document. The win is
lifecycle — editing runs without the heap — plus conversion no longer blocking
the frame's main thread.

## One definition of a conversion

`x2t_helper.js` is loaded in both places and branches on `typeof document` at
exactly three sites: `loadScript` (a `<script>` tag in the frame,
`importScripts` in the worker), `fetchFonts` (see below), and `downloadFile`
(frame only — the worker returns bytes and the frame's own instance is what the
vendor calls to hand them to the host).

The alternative was reimplementing the conversion worker-side, and the file is
not a thin wrapper: format codes, the `.doc`/`.xls`/`.ppt` two-step via docx,
the PDF-changes merge, media round-tripping, exit-code classification. Two
copies would drift. `test/unit/vendor-contract.test.ts` now pins the
dual-environment symbols, because a re-vendored helper that dropped them would
put the heap back in the frame with nothing else noticing.

## Fonts cross as a list, not as bytes

`fetchFonts` builds its font files by fetching `fontFilesPath + file.Id` for
each face the open document flagged `NeedStyles` and XOR-decoding a 32-byte
prefix. Measured: 14 files and 4.6 MB for a one-paragraph Latin document, 16
files and 25.4 MB for a CJK PDF export — **per conversion**. Sending those bytes
would have cost more than the memory is worth.

So the proxy sends the list (a few KB) and the worker fetches the same URLs off
the same HTTP and Service Worker cache. Two details that are not optional:

- `fontFilesPath` is `'../../../../fonts/'`, relative to the **editor frame's
  document**. The worker would resolve it against its own directory. It is made
  absolute before it crosses.
- The list has to be collected _after_ the font system is up. See below.

## The three things that broke

### 1. Transferring the editor's own buffer detached it

The first version transferred the request buffers to the worker. For
`convertFromBin` that buffer is the live `Editor.bin` the editor handed us, and
transferring it leaves the frame holding a zero-length view. Exporting to PDF
and then opening the result stopped working.

Nothing is transferred on the way in now — it costs a copy per conversion and
buys not corrupting the document. Results still transfer back; those buffers
belong to the worker.

### 2. `instanceof` across realms

The proxy runs in the page's realm; the values come from the editor frame's,
where `value instanceof Uint8Array` is `false` for a perfectly good
`Uint8Array`. docx was unaffected because it arrives as a blob URL string. The
PDF editor was not: it opens through `loadLocalBinaryDocument`, which passes
bytes straight in, so the proxy reported `Document conversion failed: nothing to
convert` and the document never loaded — while the export that produced it was
perfectly valid (29 KB, `%PDF-1.4`, one embedded `/FontFile2`, one page, proper
trailer).

`toBytes` now uses `ArrayBuffer.isView` and `Object.prototype.toString`, both of
which read internal slots rather than prototypes. CLAUDE.md documents the same
trap for the E2E harness; it applies here for the same reason.

### 3. The font-system race came back, quieter

Guard 3 exists because `fetchFonts` walks `AscFonts.g_font_infos` and
`g_font_loader.fontFiles[index].Id` while both are still being built, and losing
that race throws a TypeError that surfaces as a **-82** — which the open-failure
guard classifies as environmental and retries. `awaitFontSystem` ordered the two.

The proxy reads exactly those fields, so it inherits the race — but not the
TypeError: an entry that is not there yet is simply skipped. That is _worse_.
The document opens, silently, with no fonts at all: the #146 failure, with no
error for anything to retry.

`waitForFontSystem` (a promise-shaped twin of `awaitFontSystem`, same cap, same
probe, same wording) now orders the list collection the same way.
`open-retry.spec.ts`'s font-system case is what caught it — it went red on
`__ooFontWaitMs` being null, i.e. nothing had waited for anything.

## Tests

`test/e2e/wasm-memory.spec.ts` was rewritten around the new arrangement and is
the acceptance test: it reads the worker through `page.workers()` and asserts
the streaming path was taken, no module exists in any frame, and the worker is
gone once it has been idle.

Three existing specs patched `AscCommon.x2t.convertToBin` by assignment and were
silently overwritten by the guard —
they would have kept passing while testing nothing. All three now install an
**accessor**, so the probe stays in front of whichever implementation ends up
there:

- `offline-seam.spec.ts` (the seam contract, now also covering the proxy's
  output surviving a foreign realm)
- `open-retry.spec.ts` ×2 (the boot-state failure and the out-of-memory abort
  still reach the retry and the toast)

Reverse validation (convention 5): with `installX2tWorkerProxy` disabled in
`iframe-guards.ts`, `wasm-memory.spec.ts` fails — no x2t worker is ever created.

Full suite green: 3411 unit tests, 163 E2E, both `@serial` cases, and the
Cloudflare Pages semantics subset.

## Worth knowing next time

- Guard 3 still wraps the frame's `AscCommon.fetchFonts`. Our conversions no
  longer call it, but the vendor may, and the guard costs nothing.
- The 30 s idle timeout is the whole tuning surface. Shorter hands the memory
  back sooner and makes the next save pay a fresh instantiate; longer does the
  reverse. 30 s was chosen so an open followed by an immediate save shares one
  worker, and a session of editing does not hold the heap.
