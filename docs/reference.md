# Technical reference

[Back to the product overview](../readme.md)

## 🔗 Routes and URL parameters

| Route                 | What it is                                                         |
| --------------------- | ------------------------------------------------------------------ |
| `/`                   | Landing page. No editor bundle is loaded until you open something. |
| `/editor`             | The editor.                                                        |
| `/history`            | Documents this browser is holding (see below).                     |
| `/help`, `/changelog` | Generated from the markdown under `content/`.                      |

Parameters on `/editor`:

| Parameter      | Description                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src=<url>`    | Open a document from a URL (the URL must allow CORS)                                                                     |
| `file=<url>`   | Same, legacy spelling; wins if both are present                                                                          |
| `new=docx`     | Start a blank document (`docx`, `xlsx`, `pptx`)                                                                          |
| `saved=<id>`   | Reopen one of this browser's saved documents — the editor puts its own id here, so a reload returns to the same document |
| `readonly=1`   | Open for viewing: editing and export are disabled                                                                        |
| `embed=1`      | Embed mode; the host page drives the editor over postMessage                                                             |
| `locale=zh-CN` | Interface language                                                                                                       |

## 🔐 Local editing and data handling

Editing and conversion run locally. Where the browser allows it, saving writes
straight back into the file you picked, so the document lives in your own file
system and not in a downloads folder. Two things are kept in the browser
itself, and both are yours to remove:

- **Copies of what you edited.** While you work, the editor saves the document
  into this browser (IndexedDB) so a refresh, a closed tab or a crash does not
  cost you the work. Reopening the editor offers it back. These copies exist so
  you can pick up where you left off — they are not a backup, so keep exporting
  anything you want to keep.
- **Seven days, then gone.** Each document is deleted automatically seven days
  after you last edited or opened it, whether or not you come back.

[`/history`](https://edit.chaxus.com/history) lists what is stored, with a
delete on every row, a delete-all, and a switch to turn autosave off entirely.
Deleting there takes effect immediately. On a shared machine, that is the page
to visit.

The optional AI assistant is off by default. With an on-device model, document content stays on your device. When you connect an AI service, the content needed for your request is sent to that service. Browser dictation may use an online speech service. In embed mode, exported files are returned to the parent application, which controls subsequent uploads.

## 🧩 Embedding via iframe

Embed the editor and drive it over postMessage. The usual split is: your system
handles auth and storage, the iframe handles editing.

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

```js
// Open a document
iframe.contentWindow.postMessage(
  { id: '1', type: 'document:open-url', payload: { url: 'https://example.com/doc.xlsx' } },
  'https://your-deployment',
);

// Listen for the result
window.addEventListener('message', (e) => {
  if (e.data?.type === 'document:opened') console.log('Ready to edit');
  if (e.data?.type === 'document:saved') uploadFile(e.data.payload.file);
});
```

Embedded editors keep no local history — the document belongs to the host page.

→ **[Full API reference](embed-api.md)** — every message type, the origin
allowlist, read-only mode and the save flow.

Also available as a component: this project powers the document preview in
[@ranui/preview](https://www.npmjs.com/package/@ranui/preview)
([docs](https://chaxus.github.io/ran/src/ranui/preview/)).

## 🚀 Deployment

A static build — no runtime, no database.

```bash
pnpm build   # outputs to dist/
```

### Static hosting (Cloudflare Pages, Nginx, Vercel, Netlify…)

Upload `dist/`. `public/_headers` carries the caching contract the site expects
(hashed assets immutable, service worker never cached); hosts that ignore it
still work, they just revalidate more.

For Nginx, serve `index.html` as the fallback for unknown routes:

```nginx
location / {
  root /var/www/document;
  try_files $uri $uri/ /index.html;
}
```

### GitHub Pages

`.github/workflows/pages-build-site.yml` builds and deploys on push to `main`.
Enable Pages in the repository settings with **GitHub Actions** as the source.

### Docker

```bash
# Basic
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest

# With HTTPS and basic auth
docker run -d --name document -p 443:443 \
  -v /path/to/certs:/ssl \
  -e SERVER_BASIC_AUTH='user:$2y$...' \
  -e SERVER_HTTP2_TLS=true \
  -e SERVER_HTTP2_TLS_CERT=/ssl/cert.pem \
  -e SERVER_HTTP2_TLS_KEY=/ssl/key.pem \
  ghcr.io/ranuts/document:latest
```

`SERVER_BASIC_AUTH` takes a BCrypt hash. Keep it single-quoted in shell commands
so `$` characters stay literal. Caching for the image is configured in `sws.toml`.

## 🔤 Fonts

The vendored OnlyOffice build ships its font library in `public/fonts/`, indexed
by `public/sdkjs/common/AllFonts.js`. Fonts are fetched on demand — a document
only pulls the ones it actually uses.

→ **[Font management guide](fonts.md)** — the indexed catalog's wire
format, the registries, and adding fonts with `bin/font-catalog.mjs`.

## 🛠 Development

```bash
pnpm install --frozen-lockfile
pnpm run dev            # dev server
pnpm run build          # production build (bin/build.sh)
pnpm run lint           # oxlint + tsc + docker config
pnpm run test           # unit tests (Vitest)
pnpm run test:e2e       # end-to-end tests (Playwright, real editor + real WASM)
```

The end-to-end suite drives the real editor and the real converter rather than
mocks, including document round trips, the embed protocol and the recovery
flow. [`explorations/`](explorations/) records why each non-obvious piece is the way it is —
worth a look before changing the editor integration.

## WebMCP agent tools

Where the browser supports it, the page registers tools an in-browser agent can
call directly instead of driving the UI: `open_document_url`,
`open_document_buffer`, `create_document`, `save_document`, `get_document_text`,
`set_readonly`, `get_document_state`. The browser fetches and converts files
locally; an external agent controls how it handles returned content. Where
the API is absent, this is a no-op.

Tools are available on top-level editor pages when the browser provides the WebMCP API. Direct full-text reading currently supports word-processing documents; other document types can be exported with `save_document` for the agent to read.

### Read-only document references

The AI Sources view can attach TXT/Markdown/CSV/TSV/JSON (256 KiB), or DOCX,
XLSX, PPTX and text-bearing PDF (20 MiB input, 256 KiB extracted text). Files
are parsed independently of the open editor. Attaching never opens, replaces,
edits or saves the current document. Parsing stays local; only the excerpts
captured for an explicit AI request are sent to its selected service.

OOXML readers bound archives to 2,000 entries and 32 MiB actual cumulative
inflation, check ZIP integrity, scan at most 100,000 XML elements before DOM
parsing, and reject entities/DTDs. Extraction allows 10,000 paragraphs or
10,000 cells across 20 workbook sheets. Slide order follows presentation
relationships; formulas are not evaluated. Unsupported embedded media is not
OCRed. PDF.js is lazy-loaded with its bundled worker, no remote fonts or URLs;
PDFs allow 100 pages. Scanned PDFs without text explain that OCR is required.
Encrypted, malformed, excessive and timed-out documents receive distinct
recovery messages. Extraction has a 15-second deadline and is canceled when
the conversation changes or the panel is disposed. No password is collected.

Offline Office extraction uses the prepared app assets; PDF extraction also
requires the optional assistant assets to have been prepared before going
offline. The module worker is included in that explicit preparation, never a
remote CDN dependency. Original attachment bytes are not persisted.
