---
title: 'Help — using the online document editor'
description: 'Learn how to open, create, edit and save documents in your browser. Find help with file recovery, offline preparation and common questions.'
eyebrow: Help
breadcrumb: Help
h1: Help
lead: 'From opening your first file to saving your changes, find the steps you need here.'
---

## Opening and creating documents

### Which file formats can I open?

Word (`.docx`, legacy `.doc`), Excel (`.xlsx`, legacy `.xls`), PowerPoint (`.pptx`, legacy `.ppt`), comma-separated values (`.csv`) and PDF (`.pdf`). Pick a file with **Open**, drag and drop it onto the page, or pass a URL with `/editor?file=https://…` / `/editor?src=https://…` (the server hosting the file must allow cross-origin requests).

### How do I create a new document?

Choose New Word, New Excel or New PowerPoint on the homepage to start a blank file. Save it to your device when finished.

### Is there a file size limit?

No fixed limit. The practical ceiling is your device's memory, because the whole document is parsed and rendered locally.

## Editing and saving

### How do I save my changes?

In supported browsers such as Chrome and Edge, the first save asks you to choose a file; later saves update that file. Other browsers download a copy. Use File → Download as to export another format. Autosave recovery copies are separate from the files you save.

### Why is the Save button sometimes greyed out?

The Save button lights up once the editor has fully loaded the document and you have made a change. If it stays grey after editing, the document did not finish loading — check the notification toast for an error and see the error-code section below.

### Can I convert between formats?

Yes, on your device: open a document and choose the target format in **Download as**. Word documents export to DOCX / PDF / TXT, spreadsheets to XLSX / CSV / PDF, presentations to PPTX / PDF. CSV files are opened as a spreadsheet and can be saved back as CSV.

### My Chinese / non-English CSV shows garbled characters elsewhere. What about here?

The editor sniffs the CSV encoding before opening it — strict UTF-8 first, then GB18030 (the "ANSI" encoding Excel uses for Chinese exports), then Latin-1 — so files that show mojibake in other tools open correctly. Saving writes UTF-8 with a byte-order mark, which Excel opens without a wizard.

## PDF

### What can I do with a PDF?

Open and read it (scroll, zoom, search), add comments and free-text annotations, and download it again as a PDF that keeps those annotations. Fillable forms can be filled.

### Can I rewrite the text of an existing PDF like a Word document?

Not as free-flowing text — PDF is a fixed-layout format. To change wording, open the original DOCX / XLSX / PPTX and export a new PDF from it. Both steps happen on your device.

## Read-only and embedding

### Can I open a document read-only?

Yes. Add `&readonly=1` to a `/editor?file=` link, or send `document:set-readonly` through the embed API. Read-only can be switched on and off at runtime without reloading the document.

### Can I put the editor inside my own web app?

Yes — the editor is designed to be embedded in an iframe and driven with `postMessage`: your page fetches the file (with its own authentication), sends it into the iframe, and receives the edited `File` back to upload wherever you want. See the [Embed API reference](/help/embed-api) and the [live demo](/embed-demo.html).

## Browser AI agents (WebMCP)

### Can an AI assistant in my browser drive the editor?

WebMCP tools perform editing and conversion locally, but a browser agent can receive document text or exported files and may send them to its own AI service. Check the agent’s data policy before sharing confidential content.

### Which browsers support it?

WebMCP is a proposal from the W3C Web Machine Learning Community Group, currently available in Chrome behind an origin trial. Firefox and Safari have not announced support. Where the browser does not provide the API, nothing is registered and nothing changes — it is a pure addition.

### Does it work in an embedded editor?

No, by design. Tools are only registered when the editor is the top-level page. A cross-origin iframe would need the embedding page to grant `allow="tools"`, which conflicts with how embedding is meant to work — so if you embed the editor, drive it with the [Embed API](/help/embed-api) instead.

### Can the agent read the document's text?

For word-processing documents, yes: `get_document_text` returns the text so the agent can answer questions about the content without exporting anything. Spreadsheets and presentations do not expose a full-text read on this engine; the tool says so explicitly (rather than returning an empty answer that would look like an empty file) and points to exporting instead.

## Offline and installation

### Does it work offline?

Connect first, open the files you need and try editing and exporting. Then disconnect and test the same steps. Visiting the homepage or installing the app does not make every feature available offline. Clearing browser data may require reconnecting. Opening files from links needs a connection.

### How do I get the newest version?

The site updates itself on the next visit. If a page seems stuck on an old build, hard-refresh (Ctrl+Shift+R / ⌘⇧R) or unregister the service worker in the browser's site settings.

## Privacy

### Are my documents uploaded anywhere?

When you edit local files directly on this site, documents are processed on your device and are not sent to our servers. The source code is public for inspection. If you use the editor through another website or let an external browser assistant read files, check its data policy.

### What does the page load from the network?

The page loads application code, editor resources, fonts and a Cloudflare Web Analytics beacon. Remote file URLs can make additional requests. Embedding hosts and external browser agents determine their own data handling.

## Errors

### What do the error codes in the notification mean?

- **-85** — the file content does not match its extension (for example an HTML page saved as `.xls`, or a `.docx` that is actually a `.doc`). Rename or re-export the file.
- **-82** — the file could not be converted; it may be corrupted, password-protected, or in a variant the engine does not support.
- **-24 / -25** — a script of the editor failed to load, usually a network hiccup or a stale cached build. Hard-refresh and try again.
- **80** — export failed inside the converter. Try another target format; if it persists please open an issue with the file type and steps.

### Something looks broken. Where do I report it?

Open an issue on [GitHub](https://github.com/ranuts/document/issues) with the browser and version, the file type, and — if it is not confidential — a file that reproduces the problem. A minimal reproduction beats a description.

## Self-hosting

### Can I run my own copy?

Yes. It is a static site, so any web server works: `docker run -d -p 8080:80 ghcr.io/ranuts/document:latest`, or build with `pnpm run build` and serve the `dist/` folder. See the [README](https://github.com/ranuts/document#readme) for HTTPS and basic-auth options and the [changelog](/changelog) for what each release changed.

### What remains after I close the tab?

With autosave enabled, recovery copies stay in this browser for 7 days after the last edit or open. Delete them or turn autosave off at /history (Saved documents). Browser data can be cleared and edits not yet saved can be lost; save important changes to a file.

### Is a built-in AI assistant available?

The built-in AI assistant is unfinished and is not a released feature.
