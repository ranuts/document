---
title: 'Convert CSV to XLSX in Your Browser — Free, Open source'
description: 'Convert CSV to XLSX for free in your browser. No Office installation, sign-up or document upload. Save the result to your device to share or keep working.'
eyebrow: Convert · .csv → .xlsx
h1: Convert CSV to XLSX in Your Browser
lead: 'Turn CSV into XLSX right in your browser. No Office installation or sign-up, with conversion on your device.'
cta: Open your CSV →
ctaHref: /
ogDescription: 'Convert CSV to XLSX for free in your browser. No Office installation, sign-up or document upload. Save the result to your device to share or keep working.'
breadcrumb: CSV to XLSX
howTo: How to convert CSV to XLSX in your browser
appDescription: 'Convert CSV to XLSX for free in your browser. No Office installation, sign-up or document upload. Save the result to your device to share or keep working.'
---

## How it works

1. Click **Open your CSV** to launch the editor in your browser.
2. Pick the **.csv** file from your device, or drag and drop it onto the page.
3. Format the cells if you like, then choose **Download as / Save as** and pick **XLSX**.
4. The XLSX is generated on your device and downloaded — nothing is uploaded.

The CSV is parsed into a real spreadsheet by the OnlyOffice engine, so your rows and columns stay intact and you can add formatting or formulas before saving as XLSX. No Excel, no account, works offline. Try the features you need while online, then use what your browser has saved offline. Opening files from links still needs a connection.

The conversion is handled by OnlyOffice's x2t engine compiled to WebAssembly, which targets the common office and text formats — Word, Excel and PowerPoint plus PDF, TXT, HTML and CSV. Because it runs in the browser tab there is no upload queue and no server-imposed size cap, and your data never touches the network. The delimiter (comma, semicolon or tab) and the text encoding are detected automatically — strict UTF-8 first, then GB18030 (the "ANSI" encoding Excel uses for Chinese exports), then Latin-1 — so files that show mojibake elsewhere open with the right characters here. Mark number, date or text columns in the sheet, then save the result as XLSX.

Going the other way is just as common: a system hands you a raw CSV export and you want a tidy, formatted workbook to read or share. Opening it here turns the flat file into a real spreadsheet, where you can widen columns, add headers, apply number and date formats and even write formulas before saving as XLSX — all without uploading the data anywhere. It is a quick way to make a machine-generated export presentable.

## Frequently asked questions

### How do I convert CSV to XLSX here?

Open the CSV in the editor, then use Download as / Save as XLSX — the conversion runs in your browser.

### Is my file uploaded to convert it?

No. When you open local files directly on this site, viewing, editing and conversion happen on your device without uploading your documents.

### Will my columns and rows stay intact?

Yes. The CSV is parsed into a real spreadsheet, so rows and columns are preserved.

### Do I need Excel or an account?

No Excel, no subscription and no sign up.

### Will number and date columns be detected?

The CSV becomes a real spreadsheet, so you can set number, date and text cell formats before saving as XLSX.

### What delimiter and encoding does it expect?

Comma, semicolon or tab are detected automatically, and so is the encoding: UTF-8 (with or without BOM), GB18030 / GBK for Chinese "ANSI" exports, and Latin-1 as the last resort.

### My CSV shows garbled characters (mojibake) in other tools — will it here?

Usually not. Mojibake means the file was saved in a legacy code page (GBK / GB18030 for Chinese, Latin-1 for Western European) and opened as UTF-8. This converter sniffs the bytes first, so Chinese exports from Excel open correctly, and saving writes UTF-8 with a byte-order mark that Excel reads without a wizard.

### Does the converter work offline?

Yes, with some preparation. Open the files you need online and try editing and exporting, then disconnect to check they work. Clearing browser data may require reconnecting. Files opened from links need a connection.
