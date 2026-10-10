# Direct action guidance

Two actionable errors were being replaced by the generic request-failed message: writing when no complete answer exists, and aligning the current paragraph while a selection exists. Direct actions now use explicit localized error keys. The presentation filter recognizes these keys and exact known translations across seven locales, including a second normalization pass. Unknown errors and messages with appended private details still receive generic guidance.

No preview, confirmation, model request, or new action is added.

## Verification

- Full unit suite: 139 files, 4,514 tests passed. Existing asynchronous PromiseRejectionHandledWarnings remain.
- Root TypeScript, scoped oxlint, and diff checks passed; production build passed with existing chunk warnings. Native runs used core1791165561/vendorb6864850e7b3.
- Chromium 151.0.7922.34 and Playwright WebKit 26.5, each in Chinese and English: four fresh native Word sessions passed both guidance cases. The driver checks actual native document text and records PasteHtml/InputText/alignment calls; rejected actions made no recorded writes. No page errors; all contexts and browsers closed.
- Seven-language unit coverage checks safe keys, repeated normalization, locale changes, and filtering of appended private details. A consuming panel regression checks the missing-answer case without tool execution.

The first native run had three passing rows and one WebKit English failure: its final request did not appear in the chat, so the assertion read the prior error. That driver did not capture input events; the precise cause is unproven. The initial receipt is preserved. The final driver explicitly focuses the input, captures Enter, and waits for the actual user request bubble before checking completion. An isolated WebKit English check and the final four-case run passed without a product send-logic change.

The native driver uses the owned local preview at port 5193 and diagnostic access to the real editor. These checks establish the two direct-action guidance paths, not inference quality, physical Safari/mobile behavior, or broad summary fidelity. The broader model acceptance work remains incomplete.

## Receipts

- [Final driver](2026-10-05-action-guidance-native.mjs)
- [Final four-case receipt](2026-10-05-action-guidance-native.json)
- [Initial receipt](2026-10-05-action-guidance-native-initial.json)
