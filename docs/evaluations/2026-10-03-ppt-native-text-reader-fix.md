# PPT native text reader correction

`readSlideShapeText` reads supported native text and space items using full Unicode code points, preserves native tabs, and distinguishes soft breaks from paragraph terminators. It supports native runs, hyperlink runs and zero-width bookmarks. This avoids the bundled SDK's `String.fromCharCode` truncation and default conversion of tabs to spaces described in the [native replacement investigation](2026-10-03-ppt-selected-text-analysis.md).

`get_presentation_text` uses this decoder before the existing SDK fallback for unsupported read-only structures. `add_slide_text` verifies inserted and existing text with the decoder. Unknown native text structures and invalid Unicode scalar values remain unverifiable; an existing shape with unreadable native text is declined before paste instead of accepting two `undefined` snapshots as preservation. Shapes without text remain supported. No UI control, preview card or confirmation was added.

## Verification

The regressions first failed for the lossy native read and insertion verification. Additional failures showed matching SDK strings could mask unknown native elements or invalid code points; these are now rejected. A preflight regression proved existing unknown native text must be declined before calling paste. Hyperlink support uses the bundled `para_Hyperlink = 48`, confirmed through the native SDK constant and a failing-then-passing regression.

Final unit validation: 111 files / 3991 tests pass, with production build and lint passing. Independent review found no remaining important issue in the reader correction after the existing-text preservation guard was added.

[Actual IM read-only verification](2026-10-03-ppt-unicode-im-read-only.json) seeds `Alex 😀\tPayment\nNext` using readiness-gated native paste, then asks the real local Qwen3 1.7B model to read the presentation through the production IM. The feedback contains the exact Unicode, tab and newline text; shape/item snapshots and native history index remain unchanged. There are no visible errors or preview cards. This proves the read-only flow for that desktop Chromium case.

## Remaining model fidelity issue

The [quoted-data IM diagnostic](2026-10-03-ppt-unicode-im-reader-quoted-diagnostic.json) asks for a new text box using a JSON-quoted terminal string. The model emits literal backslash-t/backslash-n and reduces boundary spaces. The [raw-data diagnostic](2026-10-03-ppt-unicode-im-reader-raw-diagnostic.json) emits correct native emoji, tab and newline data but omits two requested trailing spaces. Both reports deliberately retain `allPassed: false`. Existing shapes remain unchanged and there are no visible tool errors, but that does not prove the user's exact data was preserved.

The native writer verifies the generated plan; it cannot detect a plan already altered by the model. Exact literal slide requests need application-side schema/data guards, as Word literal replacement already uses. That issue, selected-text replacement integration, tracked Stop/history handling, shape formatting/geometry, save/reopen and other models/devices remain separate work. This reader correction does not complete the broader goal.

Follow-up: [PPT literal text planning](2026-10-03-ppt-literal-text-fidelity.md) now supplies schema/data guards for explicit raw and JSON-decoding commands, with real validation across all four configured GPU models and the CPU fallback. The original failed diagnostics remain unchanged; general language fidelity and the other broader requirements are not declared complete.
