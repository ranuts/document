---
title: Embed a Document Editor in Your Website — iframe + postMessage API
description: Embed a DOCX, XLSX, PPTX and CSV editor into your web app with one iframe and a postMessage API. Auth and files stay in your app — the editor never sees your tokens. Open source (AGPL-3.0), self-hostable, white-label.
eyebrow: Developers · Embed
h1: Embed a Document Editor in Your Web App
lead: Add a **DOCX, XLSX, PPTX and CSV** editor to your product with a single iframe and a **postMessage** API. Your app keeps auth, file access and upload — the editor just edits, and never sees your users' tokens.
cta: Open the live demo →
ctaHref: /embed-demo.html
ogDescription: Drop a DOCX/XLSX/PPTX/CSV editor into your app with one iframe. Auth stays in your app; the editor never sees your tokens. Open source & self-hostable.
breadcrumb: Embed Document Editor
howTo: How to embed a document editor in your website
appDescription: 'An embeddable DOCX/XLSX/PPTX/CSV editor: drop it into any web app with an iframe and drive it with a postMessage API. Authentication and file access stay in the parent app.'
---

The editor runs entirely in the browser with the OnlyOffice WebAssembly engine, so documents are rendered and edited on the client — you don't stand up a document server. The recommended pattern keeps a clean boundary: **the parent app handles authentication, fetching and saving; the iframe handles editing only.** Tokens, cookies and business APIs stay in your app.

## Add it with one iframe

Then talk to it over `postMessage`. Every command takes an `id` so you can match it to the reply, and every editor event is a `document:*` message:

## What you get

- One iframe + a small **postMessage** command/response API — no SDK to install
- Open from a **URL, a File, or an ArrayBuffer** your app fetched with its own credentials
- Save back to **XLSX, DOCX, PPTX or CSV**, returned as a `File` for your app to upload
- Read-only mode, per-message origin locking (`embedOrigin`), and a state query
- No document server to run — editing is 100% client-side WebAssembly
- Open source (AGPL-3.0) and self-hostable — embed it under your own domain

## How it works

1. Add the iframe pointing at `/editor?embed=1`, sized to your layout.
2. Wait for the `document:ready` event, then send `document:open-url`, `open-file` or `open-buffer`.
3. The user edits in place; the file never leaves the browser unless your app sends it somewhere.
4. Send `document:save`; the editor returns the edited file via `document:saved`, which your app uploads with its own auth.

## Read-only and preview mode

Open a document read-only (a viewer, a review step, a locked record) by passing `readonly: true` with the open command, and switch at any time with `document:set-readonly` — no reload, the document stays where the user was. In read-only mode editing is disabled and `document:save` answers with `document:error`; `document:get-state` reports the current `readonly` flag.

## Frequently asked questions

### How do I embed the document editor?

Add one iframe pointing at `/editor?embed=1`, then drive it with a postMessage API to open and save documents. A working demo is at [/embed-demo.html](/embed-demo.html).

### Does the editor see my users' auth tokens?

No. Auth, file fetching and upload stay in your app — your app fetches the file with its own credentials and passes the bytes to the editor, so tokens and cookies never enter the iframe.

### Which file formats can the embedded editor handle?

DOCX, XLSX, PPTX and CSV, edited client-side with the OnlyOffice WebAssembly engine. The save command exports to XLSX, DOCX, PPTX or CSV.

### Can I self-host it or use it white-label?

Yes. It's open source under AGPL-3.0 and ships as static files, so you can host your own copy and embed it under your own domain.

### How do I restrict which site can talk to the editor?

Add `embedOrigin` to the iframe URL to lock messaging to a specific origin, and verify `event.origin` in your own message handler.

### Can I show a document read-only, or lock it after a while?

Yes. Pass `readonly: true` when opening, or send `document:set-readonly` at any time — it switches the live editor without reloading, and saves are refused while locked.
