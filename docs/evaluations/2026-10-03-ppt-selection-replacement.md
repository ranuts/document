# PPT selection replacement through IM

The existing `replace_selection` tool now dispatches PPT edits to native plain-text paste. It is offered to the PPT planner only when an exact nonempty native text selection has been captured. No preview card, additional confirmation or UI control was added. Native Undo and Save remain the document workflow.

The writer reuses the existing PPT blocking action, owned history group and prior-Redo preservation. It derives the exact expected text from captured native selection offsets, verifies that the same text box and shape order remain, checks text outside the selection and in other shapes, and verifies the original shape bounds. Native character decoding preserves emoji, tabs, line breaks and boundary spaces. Explicit literal replacement commands use schema literals and an independent comparison after model planning; altered text is rejected before writing.

During native preparation, a proof binds history point/item identities and the logical cursor. A competing edit or changed cursor invalidates the old insertion. After owned insertion the proof is refreshed for verification and rollback. If a foreign edit invalidates the proof, recovery closes only the operation's group marker using the editor's runtime history enum; it does not cancel or merge the foreign history points.

## Actual native editor evidence

[Native writer report](2026-10-03-ppt-replacement-native.json) runs the current source bundle against an isolated production PPT editor, with the service worker disabled solely for the test-script route. Four cases pass:

- Exact replacement containing emoji/tab, with exact full snapshots after Undo/Redo.
- Multiline replacement with boundary spaces, with exact Undo/Redo.
- Stop during deferred native preparation restores the document and prior native Redo point/item identities, ignores the late insertion, and allows the next replacement and its Undo/Redo.
- A foreign edit during preparation expires the old operation while preserving native history references and independent Undo/Redo; the next replacement also succeeds.

The SDK deletes selected text before its deferred paste insertion. With a foreign edit already present, the writer deliberately does not automatically undo that deletion together with the foreign edit. The report captures the intermediate `beforeForeign` state (`Alpha \n`): one native Undo removes the foreign insertion, a second Undo restores this operation's earlier deletion, and two Redos restore both. The historical [diagnostic](2026-10-03-ppt-replacement-foreign-undo-diagnostic.json) retains the failed expectation that one Undo should restore the original selection, despite the deletion belonging to a separate operation. Its false result is not a product success claim.

## Actual local-model IM evidence

Every case replaces the second `Alpha` in `Alpha Alpha` with `项目 😀\tPayment\n  NOT approved  `, checks canonical native characters, retains neighboring shapes/bounds, and compares exact native Undo/Redo snapshots. All seven normal cases pass, show concise checked-result feedback, and produce no visible errors or preview cards:

| Runtime | Command | Report |
| --- | --- | --- |
| Qwen3 1.7B WebGPU | English | [report](2026-10-03-ppt-selection-replacement-im-1_7-en.json) |
| Qwen3 1.7B WebGPU | Chinese | [report](2026-10-03-ppt-selection-replacement-im-1_7-zh.json) |
| Qwen3.5 0.8B WebGPU | English | [report](2026-10-03-ppt-selection-replacement-im-0_8-en.json) |
| Qwen3.5 2B WebGPU | English | [report](2026-10-03-ppt-selection-replacement-im-2b-en.json) |
| Qwen3 4B WebGPU | English | [report](2026-10-03-ppt-selection-replacement-im-4b-en.json) |
| Qwen3 0.6B GGUF / WebKit WASM CPU | English | [report](2026-10-03-ppt-selection-replacement-im-cpu-en.json) |
| Qwen3 0.6B GGUF / WebKit WASM CPU | Chinese | [report](2026-10-03-ppt-selection-replacement-im-cpu-zh.json) |

[Real IM Stop report](2026-10-03-ppt-selection-replacement-im-stop.json) uses Qwen3 1.7B, pauses native preparation and clicks the visible Stop button. The input recovers, the document and history references return exactly, the late preparation cannot insert, the original Redo works, and the next IM replacement plus its native Undo succeeds.

## Verification and remaining scope

All 111 test files / 4030 tests, production build and lint pass. Seven new regression cases cover exact native replacement, selection preflight, foreign history preservation and literal planner behavior. The full suite continues to emit the existing asynchronous rejection-handled warnings in converter-loading tests documented in the preceding selection-reader evaluation. Independent review identified the foreign-group merge issue; the fix passes the revised regression fixture and actual native checks.

This verifies ordinary text boxes on normal slides. Grouped shapes, chart/table text, special numbering, complete formatting/links/bookmark preservation and physical mobile devices remain broader validation work. The follow-ups below verify sampled Save/reopen behavior and all configured models in the controlled Stop scenario. The current writer rejects a target that cannot be identified among the current slide's text boxes or cannot be decoded/verified. The overall local-AI goal remains active.

Save/reopen follow-up: [actual native Save analysis](2026-10-03-ppt-selection-save-reopen-analysis.md) retains the earlier failure and records the correction in commit `064e60f`. The corrected actual IM report passes text, sampled character styles including paragraph ends, boundary typing, bounds and native Undo/Redo. Complete metadata preservation remains unverified. The corrected implementation passes 112 test files / 4035 tests, production build and lint.

## Stop coverage across configured models

The current production build passes the same visible IM Stop scenario with every configured text runtime:

| Actual engine | Report |
| --- | --- |
| Qwen3 1.7B WebGPU | [report](2026-10-03-ppt-selection-replacement-im-stop-font-fixed.json) |
| Qwen3.5 0.8B WebGPU | [report](2026-10-03-ppt-selection-replacement-im-stop-0_8.json) |
| Qwen3.5 2B WebGPU | [report](2026-10-03-ppt-selection-replacement-im-stop-2b.json) |
| Qwen3 4B WebGPU | [report](2026-10-03-ppt-selection-replacement-im-stop-4b.json) |
| Qwen3 0.6B GGUF / WebKit CPU | [report](2026-10-03-ppt-selection-replacement-im-stop-cpu.json) |

Each case runs real local-model planning, deliberately holds native `pre_Paste`, clicks the visible Stop button, and compares full recorded native character/shape snapshots. It verifies original history point/item identities and index, releases the held preparation to check late-insertion suppression, uses original Redo, then performs another real IM replacement and Undo. All cases show stopped feedback, recover the composer, have no native busy/paste flags, and produce no page errors or preview cards. The reports record the actual engine label and production editor bundle URL; the CPU case explicitly disables WebGPU and requires the loaded CPU engine.

These are cached-model runs with English commands in isolated desktop Playwright browsers. Holding preparation is controlled fault injection, not evidence about timing frequency on physical devices. This does not establish every Stop timing, Chinese Stop planning, cancellation during inference/loading, complete formatting metadata. All-model coverage of the recorded native Save scenario is documented in the follow-up below. No production behavior changed in this matrix follow-up; lint passes.

Save matrix follow-up: [native Save/reopen analysis](2026-10-03-ppt-selection-save-reopen-analysis.md#save-reopen-coverage-across-configured-models) records passing actual IM replacement, sampled formatting, native Undo/Redo, Save and reopen for all five configured text runtimes. This is desktop cached-model evidence for the recorded text box, not complete document-format coverage.
