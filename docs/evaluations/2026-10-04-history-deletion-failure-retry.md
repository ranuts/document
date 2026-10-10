# History deletion failure: keep retry focus

Deleting all history can fail while the confirmation remains visible. Previously, the success-focus restoration also ran after failure and moved keyboard focus outside the confirmation onto the original delete-all entry. Focus now returns to that entry only when confirmation is hidden; if deletion fails and the user has not moved focus elsewhere, it returns to the enabled confirmation button for retry. No extra controls or confirmation stages were introduced.

A repository clear rejection reproduced the old behavior in a failing unit test. After the change, build succeeded, all 116 test files / 4260 tests passed, source oxlint excluding existing scratch diagnostics passed, TypeScript and Docker config checks passed. The full suite retains existing asynchronous handled-rejection warnings.

Actual Chromium exercised Enter to confirm an injected repository failure: source messages remained, confirmation stayed visible and focus was on the retry button. Clearing the injected failure and pressing Enter again deleted history, hid confirmation and returned focus to the original entry. Existing current/all successful deletion, native IndexedDB reload and actual JSON download checks also passed. The browser and isolated Vite server closed.

The failure is injected, not a physical disk/quota/browser storage outage. This isolated source harness does not certify OS durability, assistive technologies or native document/model quality. Run verify-history-deletion-failure-retry-browser.py to verify captured outcomes and source/probe hashes. Historical focus reports retain their original source hashes and are not rewritten.
