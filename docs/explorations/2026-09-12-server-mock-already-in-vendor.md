# The Docs Server mock we were going to write is already in the vendor

2026-09-12

## Why we looked

A third-party local-first Office site (also OnlyOffice + Wasm + Cloudflare Pages,
Next.js) takes a different integration route from ours: instead of the offline
build's serverless path, it runs the **standard Docs Server client** and
emulates the server inside the browser -- `io` replaced by a MockSocket, the
editor iframe's `XMLHttpRequest` / `fetch` routed through middleware,
`/downloadas/<key>` collecting the save parts, `/upload/<key>` answering image
uploads, `/plugins.json` served locally. x2t runs page-side in a Web Worker and
the editor is handed `Editor.bin` plus media blob URLs.

On paper that answers several of our sorest points at once: x2t's heap would sit
in something we can `terminate()`, the image pipeline would be an endpoint
instead of a self-healing patch, and the sdkjs plugin ecosystem would work. The
question was whether to migrate. This was meant to be a one-day judgment probe:
feed the editor a fake server and see whether it takes the protocol path at all.

## What we found before writing any code

The probe never needed a MockSocket, because the offline build already ships
one. Appended to `public/sdkjs/<app>/sdk-all-min.js` is an IIFE that does:

```js
window.isOffline = true;
window.AscCommon.DocsCoApi.prototype._initSocksJs = function () {
  var self = this;
  return (this.socketio = {
    emit: function (event, msg) {
      var reply = respond(msg);
      reply && typeof reply.then === 'function'
        ? reply.then(function (v) {
            self._onServerMessage(v);
          })
        : self._onServerMessage(reply);
    },
  });
};
```

`CDocsCoApi` is alive, `isCoAuthoringEnable` is `true`, and the client speaks the
whole protocol -- `auth`, `isSaveLock`, `saveChanges`, `getLock`,
`releaseLock`, `documentOpen`. It just speaks it to a function. The local
responder answers three messages (`openDocument`/`imgurls` by fetching or
decoding images into blob URLs, `isSaveLock` -> `saveLock:false`, `saveChanges`
-> `unSaveLock`) and echoes everything else straight back to `_onServerMessage`.
Auth and license are synthesized separately, by the `Offline` controller in
`public/web-apps/apps/<app>/main/app.js`:

```js
DE.Controllers.Main.prototype.loadDocument = async function (e) {
  original.call(this, e);
  if (window.isOffline) {
    this.api.onLicense({ type: 'license', license: {}, advancedApi: true });
    this.api.onAuth({ type: 'auth', result: 1, licenseType: 3 });
    const bin = e.doc.url
      ? await AscCommon.x2t.convertToBin(e.doc.url, e.doc.title, e.doc.fileType)
      : { binary: 'DOCY;v5;7372;<base64 empty document>' };
    this.api.loadDocumentData(bin);
  }
};
```

So the two architectures are the same idea with the seam in a different place.
Writing our own MockSocket would replace a working in-process responder with an
equivalent one. Structurally it buys nothing.

What it _could_ buy is protocol surface we currently leave unanswered: the
responder stores no changes (`saveChanges` is acked and dropped), grants and
releases every lock immediately, and returns an empty `authChanges`. A richer
responder is where a real change log -- crash recovery at change granularity
rather than our "export the whole document every 90 s" -- would have to live.
That is a feature we do not have, not a defect in how we are wired.

## The seam that does matter

The same patch establishes that every byte x2t touches crosses exactly two
functions on one object:

| direction | call                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| open      | `AscCommon.x2t.convertToBin(url, title, fileType)` -> `api.loadDocumentData({ binary, media })`             |
| save      | `baseEditorsApi._downloadAsFromLocal` -> `AscCommon.x2t.convertFromBin({ binary, medias, targetExt, ... })` |

`AscCommon.x2t` is our own `x2t_helper.js` patch (`AscCommon['x2t'] = new
X2TConverter()`), so the object is one we already own. Moving x2t out of the
editor frame is therefore a proxy over two methods, not a server
reimplementation.

The one thing that could have blocked it is the realm boundary. A page-owned
worker delivers results as objects belonging to the _page's_ realm, while the
editor consumes them inside the frame's realm, where `instanceof` against frame
constructors is `false` -- the same cross-realm trap already documented for our
E2E harness.

`test/e2e/offline-seam.spec.ts` settles it. It installs an accessor on
`AscCommon.x2t` before any vendor script runs (the subscribe-on-assignment trick
guard 10 uses), lets the real conversion run, re-creates the result with the
**parent realm's** `structuredClone`, and hands the editor that foreign object.
Measured:

```
convertToBin: 1 call  ('seam.docx', 'docx')
  keys        [fileName, fileExt, type, media, binary, size]
  binary      Uint8Array(786)
  media       {}
  crossRealm  true
  sameConstructor  false        <- foreign constructor, as a worker result would be
convertFromBin: 1 call  { targetExt: 'docx' }
_initSocksJs: the in-process responder above, no socket.io
```

The document opened and round-tripped its text intact. The seam is realm-safe.

Reverse validation (convention 5): truncating the substituted `binary` to half
its length turns the round-trip assertion red, so the editor really consumes the
object we return rather than the original -- the substitution is load-bearing.

## What the move is worth

`test/e2e/wasm-memory.spec.ts` measures the x2t heap at ~340 MB after an open
and ~408 MB after saving a 20k-row workbook. `X2TConverter.prototype.destroy`
exists but nothing in the repository or the vendor calls it, and it only drops a
JS reference -- the emscripten glue keeps `wasmMemory` / `HEAPU8` on the frame's
`window` regardless. In the frame, that heap is pinned for the life of the
frame.

Behind a page-owned worker it becomes transient: terminate after the open,
respawn on save, and the editing session runs without it. That does **not**
lower the peak at open time, which is what issue #144 actually fails on, so this
is not a fix for #144 -- it is ~340 MB returned for the rest of the session, and
guard 10 (`guards/wasm-binary-release.ts`, which clears the two `wasmBinary`
references) becomes unnecessary because terminating the worker tears down its
whole realm.

Note also that a dedicated worker runs on its own thread in the _same_ renderer
process as its document, and our editor iframe is same-origin, so nothing moves
to another process either way. The win is lifecycle, not isolation.

## Decision

Do not migrate to a hand-written server mock. We are already on that path; the
vendor put us there and the responder works.

Take the separable win instead: proxy `AscCommon.x2t`'s two methods to a
page-owned worker, so the heap is terminatable. The seam is proven realm-safe
and pinned by a test.

## Also found, not fixed here

`errorBadImageUrl` is hardcoded **in Chinese** in the offline patch of all four
editors (`documenteditor` / `spreadsheeteditor` / `presentationeditor` /
`pdfeditor`, plus their `ie/` twins):

> 无法加载图片：地址无效或目标站不允许跨域访问（可通过 editorConfig.imageProxy 配置图片代理）

It reaches users of all seven site languages whenever an inserted image URL
fails. The same patch reads `editorConfig.imageProxy` into
`window.offlineImageProxy` as a documented fallback for that case, which we do
not currently set. Both belong in a separate change.

## Files

- `test/e2e/offline-seam.spec.ts` -- pins `window.isOffline`, the socket-free
  responder, the single conversion seam, and its realm-safety. A vendor upgrade
  that moves any of them turns it red.
