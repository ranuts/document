# PPT selected-text replacement: native feasibility and readback limits

PPT IM currently exposes presentation reading, slide actions and new text boxes. `document-tool-plan.ts` does not expose replacement in slides, and the shared `replace_selection` implementation explicitly requires Word through `pasteWordHtml`. Selected-text replacement remains missing from the product.

## Actual native evidence

[The native API probe](2026-10-03-ppt-selected-text-native-probe.json) selects exactly `Alpha` inside the title shape's `Alpha target body`. `asc_enterText('Alex')` replaces the selected text and native Undo/Redo restores the respective snapshots, without changing the neighboring shape or shape count. `pluginMethod_InputText` does nothing in this isolated runtime. Its attempted Undo therefore undoes the setup edit; this is diagnostic evidence, not successful replacement recovery.

[The literal entry matrix](2026-10-03-ppt-selected-text-literal-matrix.json) covers English, bilingual business data, multiline text, boundary spaces, a tab and emoji. Text-only matching initially looks successful for newlines and tabs, but [native item inspection](2026-10-03-ppt-selected-text-native-character-diagnostic.json) shows `asc_enterText` represents LF as a space item (type 2 / code point 10), rather than a paragraph or native line-break element. It is not an appropriate complete plain-text replacement implementation. Emoji is a correct native text item with code point 128512, although the SDK reader returns U+F600.

[An early native paste attempt](2026-10-03-ppt-selected-text-native-paste-matrix.json) failed during font shaping (`m_pFaceInfo` was null). The harness had waited only for the sidebar entry and had not proved document/full API loading complete. The failed report is retained, not described as a product failure or passing case.

[The readiness-gated native paste matrix](2026-10-03-ppt-selected-text-native-paste-ready-matrix.json) waits for `isDocumentLoadComplete`, `isLoadFullApi` and no long action before using `asc_PasteData` with the native Text clipboard format and awaiting its completion callback. All six cases preserve native selected-text replacement, neighboring shape text, shape count and exact captured paragraph/run/item snapshots through Undo/Redo. Multiline input creates two paragraphs. Tab input creates a native type-21 tab item; emoji retains code point 128512.

The raw `GetText()` assertions still fail for the tab and emoji cases. Bundled `public/sdkjs/slide/sdk-all.js`, `ParaRun.prototype.Get_Text`, converts `GetCodePoint()` through `String.fromCharCode` and defaults a native tab to a space. This readback does not faithfully represent all plain text. The separate [native-code-point verification](2026-10-03-ppt-selected-text-native-codepoints.json) reconstructs captured text/space items with Unicode code points, native type-21 tabs and paragraph/line-break items. All six reconstructed cases and Undo/Redo checks match. The source report's raw mismatch status remains unchanged.

## Integration requirements

Reuse the existing selected-text command without a new UI mode, preview card or confirmation. Expose replacement only after the target captures the selected shape/content identity, exact selection position, document/history identity and native text. Slide number alone does not bind a text selection. Reject changed targets before writing; use the existing native completion, cancellation, blocking-action and history ownership mechanisms rather than the InputText wrapper or unguarded character entry.

Verify Unicode, tabs and line breaks through native character data. Verification must bind the actual replacement location and check outside content, shape identities and surrounding text. Preserve failures and cancellation without undoing independent edits or removing prior Redo. Then validate real IM/model planning, partial and whole-shape selections, formatting and geometry, native Undo/Redo, save/reopen, and Stop during font preparation.

This investigation does not add a product tool. It validates simple title-shape native replacement in isolated desktop Chromium only. Groups, tables, charts, notes, master/layout shapes, complex formatting, rendering/overflow, physical devices and local-model behavior are not proved by these reports. The broader goal remains active.
