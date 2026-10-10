# Restore focus after canceling history deletion

The existing history confirmation moves focus to Cancel. Previously cancellation hid that focused element without returning focus to the initiating action. The controls now remember the current-conversation or all-history deletion button and focus it after cancellation, then clear the reference. No confirmation, deletion target, persistence behavior or interface step changes.

Two unit regression cases first failed with focus remaining on Cancel. They now verify focus returns to the correct trigger and the confirmation becomes hidden. Build, 116 test files / 4204 tests and lint passed. Independent review found no Important issue.

An actual owned Chromium WebGPU IM greeting was exported, then current-conversation deletion and all-history deletion were separately canceled. In both cases document.activeElement equals the corresponding original button and the visible reply is unchanged. Subsequent confirmed current-conversation deletion still clears the reply. The exported assistant text remains clean and native Word text remains empty. The verifier checks these observations and binds the raw report to executed driver SHA-256.

The browser actions are Playwright clicks, so this proves focus position after cancellation, not a complete keyboard-only or screen-reader workflow. Saving is explicitly disabled; this diagnostic only deletes its new in-memory conversation. Confirmed deletion focus, asynchronous storage failure focus, saved IndexedDB behavior, other locales, CPU, cold offline, physical devices and network privacy are not certified here. The warm profile has service workers blocked and network available. Inherited empty-document Undo/Redo fields are ignored.
