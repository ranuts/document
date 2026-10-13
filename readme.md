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

Open, edit and save Word, Excel and PowerPoint files. Annotate PDFs. All in your browser, with no account or Office installation required.

**[Try it online](https://edit.chaxus.com/)** · [View source](https://github.com/ranuts/document)

---

## ✨ Features

- **Local editing.** Document conversion, editing and export run on your device.
- **Save your way.** Write back to your chosen file where supported, or download an export.
- **Pick up where you left off.** Reopen recent work from this browser.
- **Ready for your workflow.** Install as a PWA, self-host or embed in your app.

## 🚀 Quick start

**[Try it online](https://edit.chaxus.com/)** · [View source](https://github.com/ranuts/document)

Or run your own copy:

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

## 📄 Formats

| Kind          | Edit                   | Also opens                  |
| ------------- | ---------------------- | --------------------------- |
| Documents     | `.docx`                | `.doc` `.odt` `.rtf` `.txt` |
| Spreadsheets  | `.xlsx` `.csv`         | `.xls` `.ods`               |
| Presentations | `.pptx`                | `.ppt` `.odp`               |
| PDF           | annotate, fill, export | `.pdf`                      |

Export supported documents to PDF.

## 🔐 Local editing and data handling

Recovery copies stay in this browser for 7 days after the last edit or open. Delete them in [Saved documents](https://edit.chaxus.com/history). Export anything you want to keep; recovery is not a backup.

Optional AI services receive the content needed for your request. On-device models keep it local. Browser dictation may use an online speech service; embedded exports are handled by the host app.

## Documentation

[User guide](https://edit.chaxus.com/help) · [Self-hosting, URLs and integration](docs/reference.md) · [Embedding API](docs/embed-api.md) · [Fonts](docs/fonts.md)

Offline use needs cached editor assets; uncached resources and remote files still need a network.

## AI document assistant (Experimental Beta)

Draft and refine text, work with spreadsheet data, create slides or ask about the current PDF page. Review changes before applying and use Undo when needed.

**Experimental Beta.** Off by default. Answers and edits can be wrong; check important results.

<details>
<summary>Watch the four demos</summary>

| Word                                                                                                                                                    | Excel                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Draft, write, summarize and undo](docs/media/ai-demos/word-ai.jpg)](https://github.com/user-attachments/assets/8d1d6386-e33a-45f2-b968-b8695c8f7da9) | [![Fill, calculate, sort and undo](docs/media/ai-demos/excel-ai.jpg)](https://github.com/user-attachments/assets/5bb253d7-3cc5-4f31-989e-0c88dcb1615c)     |
| **Draft, write, summarize and undo**                                                                                                                    | **Fill, calculate, sort and undo**                                                                                                                         |
| PowerPoint                                                                                                                                              | PDF                                                                                                                                                        |
| [![Create, duplicate and undo](docs/media/ai-demos/pptx-ai.jpg)](https://github.com/user-attachments/assets/db3fc7a7-b54e-4147-a7ca-e7f16243618e)       | [![Read, ask questions and review notes](docs/media/ai-demos/pdf-ai.jpg)](https://github.com/user-attachments/assets/f01c2da6-0669-4111-87c1-c4440f4a60e9) |
| **Create, duplicate and undo**                                                                                                                          | **Read, ask questions and review notes**                                                                                                                   |

Complete workflows at normal speed, recorded in English with a loaded local Qwen3 4B model. Response times vary by model and device.

[Videos, captions and text descriptions](docs/media/ai-demos/README.md)

PDF assistance covers selectable text and page notes, not scanned-image text or rewriting PDF body text.

</details>

## 🛠 Development

Run from source:

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install --frozen-lockfile
pnpm run dev
```

Feedback and contributions are welcome: [Issues](https://github.com/ranuts/document/issues) · [Pull requests](https://github.com/ranuts/document/pulls)

## 📚 Built on

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) and [web-apps](https://github.com/ONLYOFFICE/web-apps) — the OnlyOffice editors
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — the WASM document converter
- [ranui / ranuts](https://github.com/chaxus/ran) — the design system and utilities this site is built with
- [se-office](https://github.com/Qihoo360/se-office), [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — prior art for running OnlyOffice without a document server

## 📄 License

[AGPL-3.0](LICENSE) · [NOTICE](NOTICE)

<details>
<summary>Upstream notices and trademarks</summary>

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

</details>
