---
title: Convert XLSX to PDF in Your Browser — Free, No Upload
description: Turn an Excel (XLSX) spreadsheet into a PDF without uploading it anywhere. The conversion runs entirely on your device — free, no account, no Excel, works offline.
eyebrow: Convert · .xlsx → .pdf
h1: Convert XLSX to PDF in Your Browser
lead: Turn an Excel **.xlsx** spreadsheet into a **.pdf** — without uploading it anywhere. The whole conversion happens locally in your browser.
cta: Open your XLSX →
ctaHref: /
ogDescription: Convert Excel XLSX spreadsheets to PDF locally in your browser. Nothing uploaded, no account, free and open source.
breadcrumb: xlsx-to-pdf
howTo: How to convert an XLSX to PDF without uploading it
appDescription: Convert Excel XLSX spreadsheets to PDF in the browser, with no upload and no account.
---

## How it works

1. Click **Open your XLSX** to launch the editor in your browser.
2. Pick the **.xlsx** file from your device, or drag and drop it onto the page.
3. Check the sheet and print area look right — the PDF follows what the editor renders.
4. Choose **Download as / Save as** and pick **PDF**. It is generated on your device and downloaded.

Spreadsheets are the files people are least willing to hand to a random web converter, because they are where the salary tables, customer lists and finance exports live. Most "XLSX to PDF" tools upload the workbook to a server anyway. This one does not: the file is read from disk into your browser tab, converted there, and never touches the network.

The conversion runs on OnlyOffice's x2t engine compiled to WebAssembly. It is a live calculation engine rather than a static preview, so formulas are laid out with their computed values, and number formats, cell styling, merged cells and frozen panes carry into the PDF the way they render on screen.

Worth knowing before you export: a PDF has pages and a spreadsheet does not, so how the sheet is paginated is what decides whether the result is readable. A wide sheet will break across pages unless you set a print area or scale it first. Check the layout in the editor before saving — what it renders is what the PDF gets.

## Frequently asked questions

### How do I convert an XLSX to PDF here?

Open the XLSX in the editor, then use Download as / Save as and choose PDF. The conversion runs in your browser.

### Is my spreadsheet uploaded to convert it?

No. It is opened and converted entirely inside your browser tab, so your data never leaves your device.

### Do I need Excel or an account?

Neither. No Excel, no 365 subscription, no sign-up.

### Are formulas exported or their values?

A PDF is a fixed rendering, so each formula appears as its calculated value — the same value the editor shows.

### Why does my wide sheet break across pages?

A PDF is paginated and a spreadsheet is not. Set a print area or scale the sheet in the editor before exporting, and the PDF follows what you see.

### Are multiple sheets included?

The workbook opens with all its sheets. Check what the editor renders before exporting, since that is what the PDF captures.

### Does it work with old .xls files?

Yes. Both .xlsx and the older .xls open with the same engine and can be exported to PDF.

### Does the conversion work offline?

Yes. Once loaded it is an installable PWA, so it keeps converting with no internet connection.
