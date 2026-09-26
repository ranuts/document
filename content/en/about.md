---
title: 'About — who builds this document editor and why'
description: 'About this open-source browser editor, its authors, source code and data handling. Local editing without required uploads.'
eyebrow: About
breadcrumb: About
h1: About this editor
lead: Who builds this, what it actually does, and how you can check both.
---

## What this is

An **in-browser editor for office documents**. You open a Word (DOCX), Excel (XLSX), PowerPoint (PPTX), CSV or PDF file and edit it directly in a browser tab.

Core opening, editing and conversion run locally in your browser without a required document upload. Optional cloud AI can send prompts and tool-provided document content to your selected provider. WebLLM runs inference locally after its model is downloaded. An embedding host can receive exported files and upload them according to its own policy.

When autosave is enabled, recovery copies are kept in this browser’s IndexedDB for 7 days after the last edit or open. Closing a tab does not remove them. You can delete copies or disable autosave at /history. Browser storage can be cleared or evicted, and edits not yet autosaved may be lost; recovery is not a replacement for saving your file.

## Who builds it

This site is built and maintained by **ranuts**, the same author behind the [`ranuts` GitHub account](https://github.com/ranuts) and the [ran component/utility libraries](https://ran.chaxus.com).

It is a personal open-source project, not a company product. There is no sales team and no venture funding behind it — which is also why there is no upsell, no "free tier" that expires, and no reason for the site to want your files.

## How you can verify all of this

Claims about privacy are cheap. These are the ways to check them yourself:

- **Read the source.** The whole thing is open source under **AGPL-3.0** at [github.com/ranuts/document](https://github.com/ranuts/document). The license means any hosted modification has to publish its source too.
- Inspect the browser’s network panel while opening, editing and saving a local file. Test optional AI, remote URLs and host integrations separately; their requests are not covered by the core local-editing claim.
- While online, open the editor and test the file formats, fonts and exports you will need. Then disconnect and verify the same workflow before relying on it offline.
- **Self-host it.** The repository includes what you need to run your own copy.

## What it is built on

The editing engine is based on **ONLYOFFICE**, compiled to run in the browser. This project wraps that engine with a local-first shell: file handling, format conversion, the offline layer, embedding support, and the interface you see.

Being built on an existing engine is deliberate. Document formats — especially DOCX and XLSX — are large, messy specifications, and a from-scratch implementation would render your files subtly wrong. Reusing a mature engine means what you see in the browser matches what you would see elsewhere.

## Limits worth knowing

An honest list, because a page that only lists strengths is not useful:

- **Large files are bound by your device.** Everything runs in your browser, so a very large spreadsheet is limited by your own memory and CPU, not by a server you can pay to upgrade.
- Core local editing: **No sync and no collaboration.** There is no server holding your document, which also means no real-time co-editing and no cross-device sync.
- **Fidelity is very good, not perfect.** Complex layouts, unusual fonts and macros can differ from a desktop suite.

If any of these matter more to you than keeping the file local, a hosted suite is the better tool — and that is a reasonable choice.

## Getting in touch

Bug reports, format problems and feature requests are best filed as issues on GitHub, where they stay public and traceable. See [Contact](/contact) for the ways to reach the project.
