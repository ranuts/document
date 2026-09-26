---
title: 'Offline Document Editor — Edit DOCX, XLSX, PPTX Without Internet'
description: 'Edit DOCX, XLSX, PPTX and CSV offline using previously cached application, engine and font resources.'
eyebrow: Offline · PWA
h1: An Offline Document Editor That Works Without Internet
lead: 'Cached editing resources can work offline; remote files and cloud AI need a connection.'
cta: Open the editor →
ctaHref: /
ogDescription: 'Edit DOCX, XLSX, PPTX and CSV offline using previously cached application, engine and font resources.'
breadcrumb: Offline document editor
howTo: How to use the document editor offline
appDescription: 'Edit DOCX, XLSX, PPTX and CSV offline using previously cached application, engine and font resources.'
---

Core opening, editing and conversion run locally in your browser without a required document upload.

Offline editing requires the application, editor engine, converter and relevant fonts and format resources to be cached and retained by your browser. One visit or PWA installation does not guarantee this. Remote file URLs and cloud AI need a network connection; local WebLLM needs its model already available.

## How it works

1. While online, open the editor and test the file formats, fonts and exports you will need. Then disconnect and verify the same workflow before relying on it offline.
2. PWA installation is optional: use the browser’s install option or Add to Home Screen. Installation does not guarantee that every resource has been cached.
3. Open the previously cached editor without a connection. If a required resource is missing or browser storage was cleared, reconnect to load it.
4. In Chrome, Edge and other browsers supporting the File System Access API, the first save asks you to choose a file and later saves write back to it. Other browsers download a copy. Export to another format with File → Download as. Recovery copies in the browser are separate from your saved file.

## Why it works offline

- Cached editing resources can work offline; remote files and cloud AI need a connection.
- **Installable PWA** — add it to your home screen or desktop and launch it like an app
- **Runs anywhere** — Chromebook, Windows, macOS, Linux, Android; any modern browser
- Edit DOCX, XLSX, PPTX and CSV
- Core local editing: No upload, no account, no sign up

## Frequently asked questions

### Does it really work offline?

Offline editing requires the application, editor engine, converter and relevant fonts and format resources to be cached and retained by your browser. One visit or PWA installation does not guarantee this. Remote file URLs and cloud AI need a network connection; local WebLLM needs its model already available.

### Does it work on a Chromebook?

Yes. It runs in any modern browser — Chromebook, laptop, Windows, macOS, Linux and Android.

### Are my files uploaded?

Core opening, editing and conversion run locally in your browser without a required document upload. Optional cloud AI can send prompts and tool-provided document content to your selected provider. WebLLM runs inference locally after its model is downloaded. An embedding host can receive exported files and upload them according to its own policy.

### Which formats can I edit?

DOCX, XLSX, PPTX and CSV, powered by OnlyOffice.

### How do I install it as an app?

Use the install icon in Chrome or Edge's address bar, or Add to Home Screen on a phone or tablet.

### Do I need to be online the first time?

While online, open the editor and test the file formats, fonts and exports you will need. Then disconnect and verify the same workflow before relying on it offline.

### Where are my files saved when offline?

In Chrome, Edge and other browsers supporting the File System Access API, the first save asks you to choose a file and later saves write back to it. Other browsers download a copy. Export to another format with File → Download as. Recovery copies in the browser are separate from your saved file. When autosave is enabled, recovery copies are kept in this browser’s IndexedDB for 7 days after the last edit or open. Closing a tab does not remove them. You can delete copies or disable autosave at /history. Browser storage can be cleared or evicted, and edits not yet autosaved may be lost; recovery is not a replacement for saving your file.

### What remains after I close the tab?

When autosave is enabled, recovery copies are kept in this browser’s IndexedDB for 7 days after the last edit or open. Closing a tab does not remove them. You can delete copies or disable autosave at /history. Browser storage can be cleared or evicted, and edits not yet autosaved may be lost; recovery is not a replacement for saving your file.

### What happens when I use cloud AI or an embedding host?

Optional cloud AI can send prompts and tool-provided document content to your selected provider. WebLLM runs inference locally after its model is downloaded. An embedding host can receive exported files and upload them according to its own policy.
