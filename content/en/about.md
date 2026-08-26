---
title: About — who builds this document editor and why
description: Who is behind edit.chaxus.com, what it does, how it is built, and where the source code lives. An open-source (AGPL-3.0) in-browser editor for Word, Excel, PowerPoint, CSV and PDF files that never uploads your documents.
eyebrow: About
breadcrumb: About
h1: About this editor
lead: Who builds this, what it actually does, and how you can check both.
---

## What this is

An **in-browser editor for office documents**. You open a Word (DOCX), Excel (XLSX), PowerPoint (PPTX), CSV or PDF file and edit it directly in a browser tab.

The part that matters most: **your file never leaves your device**. There is no upload step, no account, and no server-side copy of your document. The editing engine runs inside your browser, so the file goes from your disk to your tab and back — nothing in between.

That single property drives most of the design decisions here: no sign-up flow, no cloud storage, no telemetry that could carry document contents, and an offline mode that keeps working when the network does not.

## Who builds it

This site is built and maintained by **ranuts**, the same author behind the [`ranuts` GitHub account](https://github.com/ranuts) and the [ran component/utility libraries](https://ran.chaxus.com).

It is a personal open-source project, not a company product. There is no sales team and no venture funding behind it — which is also why there is no upsell, no "free tier" that expires, and no reason for the site to want your files.

## How you can verify all of this

Claims about privacy are cheap. These are the ways to check them yourself:

- **Read the source.** The whole thing is open source under **AGPL-3.0** at [github.com/ranuts/document](https://github.com/ranuts/document). The license means any hosted modification has to publish its source too.
- **Watch the network tab.** Open your browser's developer tools, load a document, edit it, and look at the network requests. You will not see your file being sent anywhere.
- **Turn off the network.** Load the site once, go offline, then open and edit a file. It keeps working, which is only possible because the editing happens locally.
- **Self-host it.** The repository includes what you need to run your own copy.

## What it is built on

The editing engine is based on **ONLYOFFICE**, compiled to run in the browser. This project wraps that engine with a local-first shell: file handling, format conversion, the offline layer, embedding support, and the interface you see.

Being built on an existing engine is deliberate. Document formats — especially DOCX and XLSX — are large, messy specifications, and a from-scratch implementation would render your files subtly wrong. Reusing a mature engine means what you see in the browser matches what you would see elsewhere.

## Limits worth knowing

An honest list, because a page that only lists strengths is not useful:

- **Large files are bound by your device.** Everything runs in your browser, so a very large spreadsheet is limited by your own memory and CPU, not by a server you can pay to upgrade.
- **No sync and no collaboration.** There is no server holding your document, which also means no real-time co-editing and no cross-device sync.
- **Fidelity is very good, not perfect.** Complex layouts, unusual fonts and macros can differ from a desktop suite.

If any of these matter more to you than keeping the file local, a hosted suite is the better tool — and that is a reasonable choice.

## Getting in touch

Bug reports, format problems and feature requests are best filed as issues on GitHub, where they stay public and traceable. See [Contact](/contact) for the ways to reach the project.
