# Online Document Editor

<p align="center">
  <a href="https://github.com/ranuts/document/actions/workflows/ci.yml">
    <img src="https://github.com/ranuts/document/actions/workflows/ci.yml/badge.svg" alt="CI Status">
  </a>
  <a href="https://github.com/ranuts/document/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/ranuts/document" alt="License">
  </a>
  <a href="https://github.com/ranuts/document/releases">
    <img src="https://img.shields.io/github/v/release/ranuts/document" alt="Version">
  </a>
  <a href="https://edit.chaxus.com/">
    <img src="https://img.shields.io/badge/Live-edit.chaxus.com-brightgreen" alt="Live site">
  </a>
</p>

<p align="center">
  <b>English</b> | <a href="readme.zh.md">中文</a>
</p>

Open and edit Word, Excel and PowerPoint files in a browser tab. There is no
server: the OnlyOffice engine and its WASM converter run on the visitor's own
device, so documents are never uploaded, and no account is involved.

**Live site: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ Features

- 🔒 **Nothing is uploaded** — every conversion, edit and export happens in the tab
- 📝 **Real editing, not preview** — DOCX, XLSX, PPTX and CSV, plus ODF, RTF, TXT and the legacy binary formats; PDFs open and can be annotated
- 🕓 **Nothing is lost if you close the tab** — edits autosave into your own browser, kept for 7 days, deletable any time ([details](#-your-data-stays-on-your-device))
- 📴 **Works offline** — installable as a PWA; after the first visit no network is needed
- 🌍 **Multi-language** — 8 interface languages for the site, 45 for the editor itself
- 🧩 **Embeddable** — full postMessage API for iframe integration
- 🤖 **Agent-ready** — exposes WebMCP tools so a browser AI agent can open, convert and read documents
- 🚀 **Deploy anywhere** — a static build; a directory of files behind any web server

---

## 🚀 Quick start

**Use it:** [edit.chaxus.com](https://edit.chaxus.com/) — nothing to install.

**Self-host with Docker:**

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

**Run from source:**

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install
pnpm run dev
```

---

## 📄 Formats

| Kind          | Edit                   | Also opens                  |
| ------------- | ---------------------- | --------------------------- |
| Documents     | `.docx`                | `.doc` `.odt` `.rtf` `.txt` |
| Spreadsheets  | `.xlsx` `.csv`         | `.xls` `.ods`               |
| Presentations | `.pptx`                | `.ppt` `.odp`               |
| PDF           | annotate, fill, export | `.pdf`                      |

Any of them can be exported to PDF. CSV keeps its encoding on the way back out
(UTF-8, GB18030 and Latin-1 are sniffed on open).

---

## 🔗 Routes and URL parameters

| Route                 | What it is                                                         |
| --------------------- | ------------------------------------------------------------------ |
| `/`                   | Landing page. No editor bundle is loaded until you open something. |
| `/editor`             | The editor.                                                        |
| `/history`            | Documents this browser is holding (see below).                     |
| `/help`, `/changelog` | Generated from the markdown under `content/`.                      |

Parameters on `/editor`:

| Parameter      | Description                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src=<url>`    | Open a document from a URL (the URL must allow CORS)                                                                      |
| `file=<url>`   | Same, legacy spelling; wins if both are present                                                                           |
| `new=docx`     | Start a blank document (`docx`, `xlsx`, `pptx`)                                                                           |
| `doc=<id>`     | Reopen a document from this browser's history — the editor puts its own id here, so a reload returns to the same document |
| `readonly=1`   | Open for viewing: editing and export are disabled                                                                         |
| `embed=1`      | Embed mode; the host page drives the editor over postMessage                                                              |
| `locale=zh-CN` | Interface language                                                                                                        |

---

## 🔐 Your data stays on your device

Documents are never sent anywhere. Two things are kept locally, and both are
yours to remove:

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

---

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

→ **[Full API reference](docs/embed-api.md)** — every message type, the origin
allowlist, read-only mode and the save flow.

Also available as a component: this project powers the document preview in
[@ranui/preview](https://www.npmjs.com/package/@ranui/preview)
([docs](https://chaxus.github.io/ran/src/ranui/preview/)).

---

## 🤖 Browser AI agents (WebMCP)

Where the browser supports it, the page registers tools an in-browser agent can
call directly instead of driving the UI: `open_document_url`,
`open_document_buffer`, `create_document`, `save_document`, `get_document_text`,
`set_readonly`, `get_document_state`. Documents still never leave the device —
the browser fetches and converts them itself. Where the API is absent, this is
a no-op.

---

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

`SERVER_BASIC_AUTH` takes a BCrypt hash; double the `$` characters for shell
escaping. Caching for the image is configured in `sws.toml`.

---

## 🔤 Fonts

The vendored OnlyOffice build ships its font library in `public/fonts/`, indexed
by `public/sdkjs/common/AllFonts.js`. Fonts are fetched on demand — a document
only pulls the ones it actually uses.

→ **[Font management guide](docs/fonts.md)** — the indexed catalog's wire
format, the registries, and adding fonts with `bin/font-catalog.mjs`.

---

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
flow. `docs/explorations/` records why each non-obvious piece is the way it is —
worth a look before changing the editor integration.

---

## 📚 Built on

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) and [web-apps](https://github.com/ONLYOFFICE/web-apps) — the OnlyOffice editors
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — the WASM document converter
- [ranui / ranuts](https://github.com/chaxus/ran) — the design system and utilities this site is built with
- [se-office](https://github.com/Qihoo360/se-office), [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — prior art for running OnlyOffice without a document server

## 🤝 Contributing

Issues and pull requests are welcome. `main` is protected: work on a branch and
open a PR, which runs lint, unit tests and three end-to-end suites (dev server,
Cloudflare Pages semantics, and the production Docker image).

## 📄 License

[AGPL-3.0](LICENSE)
