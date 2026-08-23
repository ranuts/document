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

To restrict messages to a specific origin, add `embedOrigin`:

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
// Response: { type: 'document:state', payload: { readonly: false, hasDocument: true } }
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
| iframe → parent | `document:saved`            | Save complete, file returned                    |
| iframe → parent | `document:state`            | Current state response                          |
| iframe → parent | `document:error`            | Operation failed                                |
