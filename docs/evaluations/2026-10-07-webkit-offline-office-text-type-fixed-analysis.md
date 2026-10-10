# WebKit offline office text-type fix verification

The production-build native process exits 0, with both case rows finished, no page errors and final context/browser closed. Original receipt SHA-256: `ce0883f6be5173b8b438d97667bdad56c1361ca1b012fb6a6a07bc4403124123`. Core version 1791382105; vendor b6864850e7b3. Earlier failed runs remain unchanged.

Both editors warm online on a new origin, then the browser process closes and relaunches. Offline mode is enabled before navigation. Editor and reopen home responses come from the service worker. Both editors restore CPU Qwen3 0.6B and generate an actual nonempty SDK chat reply without editing the document.

Excel's actual completion includes valueType=text. B2 preserves `00123`; Undo restores empty, Redo restores the literal. Native Save yields an 8,410-byte XLSX, and offline reopen reads the exact literal. Independent ZIP/XML inspection confirms B2 is a shared-string cell resolving to `00123`.

PPT adds one slide and one exact-text box; two Undo and Redo steps restore the respective snapshots. Native Save and offline reopen preserve the edited snapshot. Independent ZIP/XML inspection finds `WEBKIT_PPTX_OFFLINE_20261007` in slide text. These text checks do not prove full visual/font fidelity.

The fix binds complete quoted English/Chinese single-cell assignments to explicit address, string and text type in the model schema, and rejects mismatched plans before execution. Unquoted numeric entry retains its existing parsing. Regression evidence: 5 expected failures before repair; 167 related tests then passed; full 143 files / 4,557 tests passed (existing asynchronously handled rejection warnings remain). Type/lint, format and production build passed.

This is desktop WebKit 27.2 coverage for these operations. Physical Safari/mobile, installed PWA, arbitrary instructions, all formatting operations, seven-language rewrite/summary/translation and general cold-cache/privacy acceptance remain open. Model request failures are retained in the raw receipt; process success does not imply every optional asset request succeeded.
