<p align="center">
  <img src="public/icons/document.svg" width="88" height="88" alt="Document Editor">
</p>

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
  <a href="#ai-document-assistant-experimental-beta">
    <img src="https://img.shields.io/badge/AI_Assistant-Experimental_Beta-orange" alt="AI Assistant: Experimental Beta">
  </a>
</p>

<p align="center">
  <b>English</b> |
  <a href="readme.zh.md">简体中文</a> |
  <a href="readme.ja.md">日本語</a> |
  <a href="readme.ko.md">한국어</a> |
  <a href="readme.de.md">Deutsch</a> |
  <a href="readme.es.md">Español</a> |
  <a href="readme.pt.md">Português</a> |
  <a href="readme.fa.md">فارسی</a>
</p>

Edit Word, Excel and PowerPoint files, and annotate PDFs—all in your browser.
No Office installation or account required. Everyday editing stays local; turn on
an experimental AI assistant to draft content, work with data and create slides.

**Live site: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ Features

- 🔒 **Local editing** — conversion, editing and export happen in the browser; you choose where optional AI requests are processed
- 📝 **Editable office files** — DOCX, XLSX, PPTX and CSV, plus ODF, RTF, TXT and the legacy binary formats; PDFs open and can be annotated
- 💾 **Save where you want** — choose a save location and keep saving to it where supported; other browsers download your exports
- 🕓 **Resume your work** — local recovery copies help you reopen recent edits; kept for 7 days and deletable any time ([details](#-local-editing-and-data-handling))
- 📴 **Works offline** — installable as a PWA; cached editor resources can be reused offline; uncached assets and remote files still require a network
- 🌍 **Multi-language** — 7 languages end to end (English, 中文, 日本語, Deutsch, Español, 한국어, Português): the pages, the app UI and the editor all follow the one you pick; the editor itself ships 45
- 🧩 **Embeddable** — full postMessage API for iframe integration
- ✨ **AI document assistant (Experimental Beta)** — draft and polish text, fill spreadsheets, create slides and ask about PDFs; use an on-device model or your own AI service
- 🤖 **Agent-ready** — exposes WebMCP tools so a browser AI agent can open, convert and read documents
- 🚀 **Deploy anywhere** — a static build; a directory of files behind any web server

---

## AI document assistant (Experimental Beta)

**Say what you need. See the result in your document.** Draft an update, fill a column, create a slide or ask about the current PDF page. The assistant works alongside the editor: inspect changes, cancel suggestions and use Undo after applying.

**Still experimental.** Answers and edits can be wrong; check important results. The assistant is off by default. Choose an on-device model or connect your own AI service. External services receive the content needed for your request.

| Word                                                                                                                                                    | Excel                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Draft, write, summarize and undo](docs/media/ai-demos/word-ai.jpg)](https://github.com/user-attachments/assets/8d1d6386-e33a-45f2-b968-b8695c8f7da9) | [![Fill, calculate, sort and undo](docs/media/ai-demos/excel-ai.jpg)](https://github.com/user-attachments/assets/5bb253d7-3cc5-4f31-989e-0c88dcb1615c)     |
| **Draft, write, summarize and undo**                                                                                                                    | **Fill, calculate, sort and undo**                                                                                                                         |
| PowerPoint                                                                                                                                              | PDF                                                                                                                                                        |
| [![Create, duplicate and undo](docs/media/ai-demos/pptx-ai.jpg)](https://github.com/user-attachments/assets/db3fc7a7-b54e-4147-a7ca-e7f16243618e)       | [![Read, ask questions and review notes](docs/media/ai-demos/pdf-ai.jpg)](https://github.com/user-attachments/assets/f01c2da6-0669-4111-87c1-c4440f4a60e9) |
| **Create, duplicate and undo**                                                                                                                          | **Read, ask questions and review notes**                                                                                                                   |

Click a preview to watch a complete workflow at normal speed, with time to read the results. English demos use the local Qwen3 4B model and fictional information. The model is already loaded when each recording starts; response times vary by model and device.

[Videos, English captions and text descriptions](docs/media/ai-demos/README.md) · [User guide](https://edit.chaxus.com/ai-document-assistant)

PDF assistance works with selectable text on the current page and page notes. It does not recognize text in scanned images or rewrite PDF body text.

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

| Parameter      | Description                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src=<url>`    | Open a document from a URL (the URL must allow CORS)                                                                     |
| `file=<url>`   | Same, legacy spelling; wins if both are present                                                                          |
| `new=docx`     | Start a blank document (`docx`, `xlsx`, `pptx`)                                                                          |
| `saved=<id>`   | Reopen one of this browser's saved documents — the editor puts its own id here, so a reload returns to the same document |
| `readonly=1`   | Open for viewing: editing and export are disabled                                                                        |
| `embed=1`      | Embed mode; the host page drives the editor over postMessage                                                             |
| `locale=zh-CN` | Interface language                                                                                                       |

---

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

## 🤖 Browser AI agents (WebMCP)

Where the browser supports it, the page registers tools an in-browser agent can
call directly instead of driving the UI: `open_document_url`,
`open_document_buffer`, `create_document`, `save_document`, `get_document_text`,
`set_readonly`, `get_document_state`. Documents still never leave the device —
the browser fetches and converts them itself. Where the API is absent, this is
a no-op.

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

[AGPL-3.0](LICENSE).

This project is a modified version of the ONLYOFFICE editors (sdkjs and web-apps,
copyright Ascensio System SIA). Its interface uses neutral descriptions without
product logos or promotional branding. Copyright, license, modification and
source information remain available in the editor's About pane and in
[NOTICE](NOTICE). Third-party GUI assets and fonts retain their respective
licenses; removing product marks does not change those licenses.

The decision to omit product logos follows the FSF's published interpretation
of AGPLv3 Section 7. It is not described as a court ruling or a guarantee of
legal compliance; the upstream position and the rationale are recorded in NOTICE.

ONLYOFFICE is a trademark of Ascensio System SIA. This project is not an official
ONLYOFFICE product and is not affiliated with, sponsored by or endorsed by
Ascensio System SIA. Names in legal notices and source references identify the
upstream technology, not this project's brand.

PWA installation and browser tabs use an independently drawn, neutral document
icon. It contains no upstream logo, trademark or project initials.
