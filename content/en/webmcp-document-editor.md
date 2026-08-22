---
title: WebMCP Document Editor — Browser AI Agents Can Drive It
description: A document editor that registers WebMCP tools, so a browser AI agent can open, read, convert and export DOCX, XLSX, PPTX and PDF files by calling them directly. Everything runs on your device.
eyebrow: For browser agents · WebMCP
h1: A Document Editor Browser Agents Can Actually Use
lead: This editor registers **WebMCP** tools, so an AI agent running in your browser can open, read, convert and export documents by calling them — instead of trying to click through a user interface built for humans.
cta: Open the editor →
ctaHref: /
ogDescription: Browser AI agents can open, read, convert and export documents here through WebMCP tools. On-device, no upload.
breadcrumb: webmcp-document-editor
howTo: How to let a browser AI agent work with your documents
appDescription: A browser-based document editor exposing WebMCP tools for in-browser AI agents; all processing is on-device.
---

## How it works

1. Use a browser that provides the WebMCP API (Chrome, behind its origin trial).
2. Open **the editor** as a normal tab — tools register only on the top-level page.
3. Ask your browser's AI agent to open, read, convert or export a document.
4. The agent calls the tools directly; the work happens on your device and nothing is uploaded.

Most web apps are opaque to an AI agent. It sees a page of buttons and has to guess which one converts a file, then hope the click landed. WebMCP — a proposal from the W3C Web Machine Learning Community Group — lets a page skip that entirely by declaring what it can do as structured, callable tools with typed inputs. This editor declares seven of them.

The tools are open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly, get_document_state. They are not a separate implementation: they call the same on-device code the buttons call, which is also what the iframe embed API drives. So an agent gets exactly the capabilities a person has, with the same guarantee — the conversion engine is WebAssembly running in your tab, and the file never leaves the device.

That property is what makes agent access reasonable here at all. Handing a document to an agent usually means handing it to whichever server that agent talks to. Here the agent orchestrates, and the document stays put: it is read from disk into the tab, converted in the tab, and written back out. An agent that reads the text of a contract to answer a question about it never uploads that contract anywhere.

Two limits are deliberate. Tools register only when the editor is the top-level page — a cross-origin iframe would need the embedding page to grant `allow="tools"`, which conflicts with how embedding is meant to work, so embedded editors are driven with the postMessage API instead. And full-text reading is available for word-processing documents; spreadsheets and presentations do not expose one on this engine, so the tool says so rather than returning an empty answer an agent might mistake for an empty file.

## Frequently asked questions

### What is WebMCP?

A proposal from the W3C Web Machine Learning Community Group that lets a web page register structured tools an in-browser AI agent can call directly, instead of the agent having to interpret and click the user interface.

### Which tools does this editor register?

Seven: open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly, get_document_state. They cover opening from a URL or from bytes, creating a new document, exporting or converting, reading the text, toggling read-only, and reporting the current state.

### Which browsers support it?

WebMCP is available in Chrome behind an origin trial. Firefox and Safari have not announced support. Where the API is absent nothing is registered and nothing changes.

### Is my document uploaded when an agent works on it?

No. The tools call the same on-device code the interface calls — the conversion engine is WebAssembly running in your browser tab, and the file never leaves your device.

### Can an agent read the contents of my document?

For word-processing documents, get_document_text returns the text so the agent can answer questions without exporting anything. Spreadsheets and presentations have no full-text read on this engine, and the tool reports that instead of returning an empty answer.

### Does it work when the editor is embedded in another site?

No, by design. Tools register only on the top-level page. Embedded editors are driven through the postMessage Embed API instead.

### Can an agent convert a file to PDF?

Yes. save_document takes a target format, so an agent can open a DOCX, XLSX or PPTX and export a PDF, all on the device.

### Do I need an account or an API key?

Neither. The editor needs no account, and it does not call any AI service itself — your browser's agent does the reasoning, this page just exposes the tools.
