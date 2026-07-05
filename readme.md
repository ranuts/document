# OnlyOffice Web

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
    <img src="https://img.shields.io/badge/Live-Demo-brightgreen" alt="Live Demo">
  </a>
</p>

<p align="center">
  <b>English</b> | <a href="readme.zh.md">中文</a>
</p>

A privacy-first, browser-based document editor powered by OnlyOffice. Edit DOCX, XLSX, PPTX, and CSV files directly in your browser — no server, no uploads, no account required.

---

## ✨ Features

- 🔒 **Privacy-first** — all processing happens locally, nothing is uploaded
- 📝 **Multi-format** — DOCX, XLSX, PPTX, CSV and more
- 🚀 **No server required** — pure frontend, deploy anywhere
- 🌐 **Open from URL** — load documents via `?src=` or `?file=` parameters
- 📦 **PWA support** — install and use offline
- 🌍 **Multi-language** — English, Chinese, and more
- 🧩 **Embeddable** — full postMessage API for iframe integration

---

## 🚀 Quick Start

**Try it online:** [edit.chaxus.com](https://edit.chaxus.com/)

**Run with Docker:**

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

**Run locally:**

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install
pnpm run dev
```

---

## 📖 Usage

### Open a document

1. Click the upload button to open a local file, or
2. Pass a URL via query parameter: `?src=https://example.com/document.docx`

> Remote URLs must support CORS.

### URL parameters

| Parameter | Description                          | Priority |
| --------- | ------------------------------------ | -------- |
| `src`     | Open document from URL (recommended) | Low      |
| `file`    | Open document from URL (legacy)      | High     |
| `locale`  | Set interface language (`en`, `zh`)  | —        |

When both `src` and `file` are present, `file` takes priority.

### PWA offline usage

Visit the editor over HTTPS (or localhost), then click the **Install** icon in the address bar. Once installed, the editor works without an internet connection.

> Service Workers don't work over `file://`. Use a local server or the installed PWA.

### As a component library

This project powers the document preview component in [@ranui/preview](https://www.npmjs.com/package/@ranui/preview).

📚 [Preview component docs](https://chaxus.github.io/ran/src/ranui/preview/)

---

## 🧩 Embedding via iframe

Embed the editor in your application and control it via postMessage. The recommended pattern is: the parent system handles auth and file upload; the iframe handles editing only.

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/?embed=1"
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

→ **[Full API reference](docs/embed-api.md)** — all message types, options, and examples including auth, read-only mode, and save flow.

---

## 🚀 Deployment

This is a pure static app — build once, deploy anywhere.

```bash
pnpm build   # outputs to dist/
```

### GitHub Pages

Push to `main` and the included workflow (`.github/workflows/pages-build-site.yml`) builds and deploys automatically. Enable GitHub Pages in your repo settings and set the source to **GitHub Actions**.

### Static hosting (Nginx, Vercel, Netlify, Cloudflare Pages…)

Upload the contents of `dist/` to any static host. No server-side runtime needed.

For Nginx, serve `index.html` as the fallback for all routes:

```nginx
location / {
  root /var/www/document;
  try_files $uri $uri/ /index.html;
}
```

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

`SERVER_BASIC_AUTH` uses BCrypt-hashed passwords. Replace `$` with `$$` in the hash for shell escaping.

---

## 🔤 Fonts

This project does not include proprietary fonts (Arial, Times New Roman, etc.) to comply with open-source licensing. Font name references are preserved for document compatibility.

→ **[Font management guide](docs/fonts.md)** — how to add fonts by index.

---

## 📚 References

- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — WASM document converter
- [web-apps](https://github.com/ONLYOFFICE/web-apps) — OnlyOffice web applications
- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) — OnlyOffice JavaScript SDK
- [se-office](https://github.com/Qihoo360/se-office) — Secure document editor
- [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — Local OnlyOffice implementation

## 🤝 Contributing

Issues and pull requests are welcome!

## 📄 License

[AGPL-3.0](LICENSE)
