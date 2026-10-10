# iframe Embed API

This project supports embedding into any web application via iframe. The recommended pattern is: **the parent system handles auth, file fetching, and upload; the iframe handles editing only.** Tokens, cookies, and business APIs stay in the parent — the editor never sees them.

A working demo is available at `/embed-demo.html` (includes sha256 logging for debugging).

---

## Embedding the editor

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

> The editor lives at `/editor`; the homepage `/` is a static landing page. Older links to `/?embed=1`, `/?src=`, `/?file=` and `/?new=` still work -- `/` redirects them to `/editor` with the same query.

Commands are accepted only from the immediate parent window. Without
`embedOrigin`, the first accepted parent command fixes the origin for the lifetime
of the editor page; later commands from a different origin are ignored.
To restrict messages to a specific origin from startup, add `embedOrigin`:

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1&embedOrigin=https://your-system.example.com"
></iframe>
```

---

## Sending commands

Include an `id` on each command to match it to the response:

```js
const iframe = document.getElementById('documentEditor');
const editorOrigin = 'https://your-deployment';

function sendEditorCommand(type, payload = {}) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  iframe.contentWindow.postMessage({ id, type, payload }, editorOrigin);
  return id;
}

window.addEventListener('message', (event) => {
  if (event.origin !== editorOrigin) return;
  const { id, type, payload } = event.data || {};
  if (!type?.startsWith('document:')) return;

  switch (type) {
    case 'document:ready':
      console.log('Editor ready');
      break;
    case 'document:opened':
      console.log('Opened', id, payload);
      break;
    case 'document:saved':
      console.log('Saved', payload.fileName, payload.file);
      break;
    case 'document:error':
      console.error('Error', payload.message);
      break;
  }
});
```

---

## Opening a document

### From URL

> **The URL must allow CORS.** The browser -- not a server -- fetches the file,
> so the response needs an `Access-Control-Allow-Origin` header that covers the
> page the editor runs on. Without it the request is blocked before the editor
> sees a single byte, and the same is true of `?src=` and `?file=` on the URL.
> This is the single most common thing to get wrong when integrating: if a file
> opens when you download it by hand but not through the editor, check the
> response headers first. Cross-origin redirects have to keep the header too.
> When you cannot add it (a third-party host, a signed URL, anything behind
> auth), fetch the file in the parent page and pass the bytes with
> `document:open-buffer` instead.

```js
sendEditorCommand('document:open-url', {
  url: 'https://example.com/files/demo.xlsx',
  fileName: 'demo.xlsx',
  readonly: false,
});
```

If the URL requires auth headers, pass `fetchOptions`. For protected files it is preferable to fetch in the parent system and pass the binary:

```js
sendEditorCommand('document:open-url', {
  url: 'https://example.com/api/files/1',
  fileName: 'demo.xlsx',
  fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
});
```

### From a file picker

```js
const input = document.createElement('input');
input.type = 'file';
input.accept = '.xlsx,.xls,.csv,.docx,.doc,.pptx,.ppt';
input.onchange = () => {
  sendEditorCommand('document:open-file', { file: input.files[0], readonly: false });
};
input.click();
```

### From an authenticated fetch (recommended for protected files)

```js
const response = await fetch('/api/files/1', {
  headers: { Authorization: `Bearer ${token}` },
});
const buffer = await response.arrayBuffer();
sendEditorCommand('document:open-buffer', { fileName: 'demo.xlsx', buffer, readonly: false });
```

---

## Read-only mode

Set at open time via the `readonly` field, or toggle at any time:

```js
sendEditorCommand('document:set-readonly', { readonly: true });
```

In read-only mode, editing is disabled and `document:save` returns `document:error`.

---

## Saving and uploading

The save command exports the current document and returns a `File` via `document:saved`. Default format is the open document's own format (a `.docx` saves as DOCX, a `.csv` as CSV, ...); pass `targetExt` to change it.

```js
sendEditorCommand('document:save', { targetExt: 'XLSX' }); // XLSX, DOCX, PPTX, CSV
```

By default the command waits for the editor to return the **edited** file. If it times out, `document:error` is returned — this prevents accidentally uploading the original unchanged file. To opt in to returning the original on timeout:

```js
sendEditorCommand('document:save', { targetExt: 'XLSX', returnOriginalOnTimeout: true });
```

Upload from the parent:

```js
window.addEventListener('message', async (event) => {
  if (event.origin !== editorOrigin) return;
  const { type, payload } = event.data || {};
  if (type !== 'document:saved') return;

  await fetch('/api/files/1', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: payload.file,
  });
});
```

> **Note:** Do not rely on `file.size` alone to detect changes. `.xlsx` is a zip archive — a minor edit can produce the exact same byte count. The built-in `/embed-demo.html` logs a `sha256` hash on every save for easier debugging.

---

## Query current state

```js
sendEditorCommand('document:get-state');
// Response: { type: 'document:state', payload: { readonly: false, hasDocument: true, dirty: false } }
```

---

## Tracking unsaved changes

The editor tells the parent whether the open document has edits the parent does not hold yet, so the parent can save when it matters (switching documents, an idle timer, closing its own page) without exporting documents nobody touched.

```js
window.addEventListener('message', (event) => {
  if (event.origin !== editorOrigin) return;
  const { type, payload } = event.data || {};
  if (type === 'document:dirty-changed') {
    console.log(payload.dirty ? 'Unsaved changes' : 'Everything saved');
  }
});
```

- `document:dirty-changed` is pushed when the flag flips, not on every keystroke: `{ dirty: true }` after the first edit, `{ dirty: false }` once a `document:save` covered every edit (or undo went back to the saved state).
- A successful `document:save` clears the flag: the parent now holds the bytes. Edits made while the export was running are not in those bytes, so they keep the document dirty -- check `payload.dirty` on `document:saved` and save again when it is `true`.
- If the upload on the parent side fails, the editor cannot know: keep your own "needs saving" state until the upload succeeds.
- `document:save` with `returnOriginalOnTimeout: true` never clears the flag, since the file returned on timeout may be the original.
- Opening another document resets the flag to `false`.

A save-on-idle loop for the parent could look like this:

```js
let idleTimer;
window.addEventListener('message', (event) => {
  if (event.origin !== editorOrigin) return;
  const { type, payload } = event.data || {};
  if (type === 'document:dirty-changed' && payload.dirty) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => sendEditorCommand('document:save'), 30_000);
  }
  if (type === 'document:saved' && payload.dirty) {
    // Edits landed during the export: they still need a save.
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => sendEditorCommand('document:save'), 30_000);
  }
});
```

---

## Message reference

| Direction       | Type                        | Description                                     |
| --------------- | --------------------------- | ----------------------------------------------- |
| parent → iframe | `document:open-url`         | Open document from URL                          |
| parent → iframe | `document:open-file`        | Open document from `File` / `Blob`              |
| parent → iframe | `document:open-buffer`      | Open document from `ArrayBuffer` / `Uint8Array` |
| parent → iframe | `document:set-readonly`     | Set read-only or editable                       |
| parent → iframe | `document:save`             | Save and return `File`                          |
| parent → iframe | `document:get-state`        | Query current state                             |
| iframe → parent | `document:ready`            | Editor initialised                              |
| iframe → parent | `document:opened`           | Document opened                                 |
| iframe → parent | `document:readonly-changed` | Read-only state changed                         |
| iframe → parent | `document:saved`            | Save complete, file returned (with `dirty`)     |
| iframe → parent | `document:dirty-changed`    | Unsaved-changes flag flipped (`{ dirty }`)      |
| iframe → parent | `document:state`            | Current state response                          |
| iframe → parent | `document:error`            | Operation failed                                |
