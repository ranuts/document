---
title: Free ONLYOFFICE Online — the Editors in Your Browser, No Server
description: Use the ONLYOFFICE editors online for free, with no Document Server to install and no account. They run inside your browser as WebAssembly, so your DOCX, XLSX and PPTX files are never uploaded. Open source, self-hostable, not affiliated with Ascensio System SIA.
eyebrow: ONLYOFFICE engine · no server
h1: The ONLYOFFICE Editors, Online and Free — Without Running a Server
lead: This site runs the ONLYOFFICE document, spreadsheet and presentation editors entirely inside your browser, compiled to WebAssembly. There is no Document Server to install, no account to create, and no upload — the file you open stays on your device.
cta: Open the editor →
ctaHref: /
ogDescription: The ONLYOFFICE editors, running client-side in your browser. No Document Server, no account, no upload. Free and open source.
breadcrumb: ONLYOFFICE online
appDescription: The ONLYOFFICE editors compiled to WebAssembly and running client-side in the browser, with no Document Server and no upload.
---

ONLYOFFICE is normally something you install: the editors are a front end for ONLYOFFICE Docs (the Document Server), which converts and stores your files on a machine you have to run and keep running. That is the right shape for a team. It is a lot of machinery when all you wanted was to open a `.docx` someone sent you.

This site is the other shape. The same editors, plus the same `x2t` conversion engine, are compiled to WebAssembly and loaded into the page. Your browser is the document server — which is why nothing is uploaded, why there is no account, and why it keeps working after you go offline.

It is a modified version of the ONLYOFFICE editors, published under the same AGPL-3.0 license. It is not an official ONLYOFFICE product, and this project is not affiliated with, sponsored by or endorsed by Ascensio System SIA.

## What you get

- **The real editors** — the ONLYOFFICE document, spreadsheet, presentation and PDF editors, not a viewer or a reimplementation.
- **The real converter** — `x2t`, the same engine ONLYOFFICE Docs uses, compiled to WebAssembly. DOCX, XLSX, PPTX, ODT, ODS, ODP, CSV and PDF in; DOCX, XLSX, PPTX, PDF, TXT, HTML and CSV out.
- **No server, no account, no upload** — the file is read from your disk into the tab and written back to it.
- **Offline** — installable as a PWA; after the first visit the engine is cached and the editor opens with no connection.
- **Open source** — AGPL-3.0, and it deploys as static files, so you can host your own copy on any web server.

## How it differs from ONLYOFFICE Docs

Being honest about this is more useful than a feature list:

- **No collaboration.** Co-editing, comments-in-real-time, user presence and everything else that needs a server between two people is not here. This is a single-user editor.
- **No connectors.** The Nextcloud / ownCloud / SharePoint integrations belong to ONLYOFFICE Docs. This site opens files from your disk, from a URL, or from a parent page that embeds it.
- **No admin.** There is nothing to configure, back up or update — and nothing to secure, since there is no stored copy of your document anywhere.
- **Your browser does the work.** A large document costs your own memory rather than a server's. The engine asks for a few hundred megabytes when it starts, which is fine on a laptop and can be tight on an old phone.
- **Everything else is the same engine**, so fonts, tables, formulas, revisions and layout survive a round trip the way ONLYOFFICE handles them.

## How to use it

1. Open the editor — no sign-up screen, no license key.
2. Pick a DOCX, XLSX, PPTX, ODT, CSV or PDF file from your device, or start a blank one.
3. Edit it. The document is opened, converted and rendered inside the tab.
4. Save it back to your disk, or export it as PDF, TXT, HTML or CSV.

## Frequently asked questions

### Is this the official ONLYOFFICE?

No. This is an independent, open-source project built on the ONLYOFFICE editors, which are published under AGPL-3.0. It is not affiliated with, sponsored by or endorsed by Ascensio System SIA, and ONLYOFFICE is their trademark. For the official products, go to onlyoffice.com.

### Is it really free?

Yes, and there is no paid tier to unlock. The source is on GitHub under AGPL-3.0 and the site is static files you can host yourself.

### Do I need to install ONLYOFFICE Docs or a Document Server?

No. The conversion engine that a Document Server would run is compiled to WebAssembly and runs in your browser instead. There is nothing to install and nothing to keep running.

### Are my files uploaded anywhere?

No. Files are read from your device and processed in the tab. You can check this in your browser's network panel while opening and saving a document, or read the source.

### Can several people edit the same document together?

No. Co-editing requires a server that both people talk to, which is exactly what this build does without. If you need collaboration, ONLYOFFICE Docs is the right product.

### Which version of the editors is this?

ONLYOFFICE 9.3, with the 9.4 build of the `x2t` converter. The exact version, and every change made to the vendor build, is listed in the NOTICE file in the repository.

### Can I embed it in my own application?

Yes — it exposes an iframe API over `postMessage`, and it is AGPL-3.0, so you can also host the whole thing under your own domain.
