# The one string the offline patch hardcodes in Chinese

2026-09-12

## What users saw

Insert a picture by URL, have the fetch fail -- a 404, a host that does not send
CORS headers -- and the editor reports:

> 无法加载图片：地址无效或目标站不允许跨域访问（可通过 editorConfig.imageProxy 配置图片代理）

In every one of the seven languages this site ships. On a Japanese or German or
Korean UI, that sentence. And it advises configuring `editorConfig.imageProxy`,
which is not a knob our users can reach -- it is a DocEditor config value, and
we deliberately do not set it, because routing a user's image URLs through a
third-party proxy is the one thing this site promises not to do.

Found while reading the vendor for
[2026-09-12-server-mock-already-in-vendor.md](2026-09-12-server-mock-already-in-vendor.md);
it was not what we were looking for.

## Why it happens

`errorBadImageUrl` is an ordinary vendor locale key. All 45 locale files carry
a translation:

| locale | value                        |
| ------ | ---------------------------- |
| en     | Image URL is incorrect       |
| zh     | 图片URL地址不正确            |
| ja     | 画像のURLが正しくありません  |
| ko     | 이미지 URL이 잘못되었습니다. |

`Common.Locale._applyLocalization` walks each dotted key and writes it onto
`window.<NS>.Controllers.Main`, and the controller definition then folds that
object into the prototype with the usual idiom:

```js
DE.Controllers.Main = Backbone.Controller.extend(_.extend({ ...definition }, DE.Controllers.Main || {}));
```

The editor reads it as `this.errorBadImageUrl` when the engine raises
`Asc.c_oAscError.ID.UplImageUrl`.

The offline build's `Offline` controller -- the same patch that provides the
in-process server responder -- then overwrites it, on the **instance**, inside
`loadDocument`:

```js
DE.Controllers.Main.prototype.loadDocument = async function (e) {
  original.call(this, e);
  if (window.isOffline) {
    this.errorBadImageUrl = '无法加载图片：地址无效或目标站不允许跨域访问（可通过 editorConfig.imageProxy 配置图片代理）';
    this.editorConfig?.imageProxy && (window.offlineImageProxy = this.editorConfig.imageProxy);
    ...
  }
};
```

An own property on the instance shadows the translated one on the prototype, so
the locale never gets a say.

`documenteditor`, `spreadsheeteditor` and `presentationeditor` all carry the
assignment (in `main/app.js` and its `main/ie/app.js` twin). `pdfeditor` has the
locale key but no override.

## The fix

Not to translate the sentence -- the vendor already translated the original into
more languages than we ship. To keep the assignment from landing.

`lib/onlyoffice/guards/bad-image-url.ts` (guard 13) captures whatever the locale
merge left on the prototype and replaces the property with an accessor whose
setter swallows exactly that one literal:

```ts
Object.defineProperty(proto, 'errorBadImageUrl', {
  get() {
    return this.__ooBadImageUrl ?? localized;
  },
  set(value) {
    if (value !== OFFLINE_BAD_IMAGE_URL) this.__ooBadImageUrl = value;
  },
});
```

Every other write goes through, so a vendor upgrade that reworded the message
legitimately still wins. If `loadDocument` already ran, the instance carries its
own copy, and the guard deletes it -- reads then fall through to the accessor.

If the locale fetch has not resolved yet there is nothing worth protecting, so
the guard reports "not yet" and the guard timer re-applies. It can never leave
the property emptier than it found it.

Deliberately **not** done: setting `editorConfig.imageProxy`. The patch reads it
into `window.offlineImageProxy` and falls back to `proxy + encodeURIComponent(url)`
when a direct image fetch fails, which would make cross-origin image insertion
work -- by sending the URL, and the user's interest in it, to whoever runs the
proxy. That is a product decision, not a bug fix.

## Tests

`test/e2e/bad-image-url-locale.spec.ts` opens a real docx and a real xlsx and
reads the property the error handler reads, off the live controller: it must not
be the Chinese literal, and must be the locale's string.

`test/unit/vendor-bad-image-url.test.ts` pins the vendor side -- that the three
apps still assign exactly the literal the guard matches, and that the translated
original is still present in `en.json` and in every language the site ships. A
vendor upgrade that reworded or dropped the override turns it red, which is the
signal to re-examine the guard rather than re-pin it.

Reverse validation (convention 5): with `installBadImageUrlGuard` commented out
of `iframe-guards.ts`, both E2E cases fail with

```
Expected: not "无法加载图片：地址无效或目标站不允许跨域访问（可通过 editorConfig.imageProxy 配置图片代理）"
```

so the defect is real and the guard is what fixes it.
