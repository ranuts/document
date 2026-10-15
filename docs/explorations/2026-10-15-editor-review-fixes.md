# October 15 editor review fixes

The six findings from the project review were implemented on
`codex/editor-review-fixes`, starting from `1330b3c5`. The existing root dependency
updates were preserved. No vendor files, storage schema, model defaults or embed
message formats changed.

## Saving and recovery

Both standalone disk saves and embed saves now use the existing SDK save-point
mechanism. Save-point validation includes items appended within the same undo
point, not just its index and identity.

The SDK's busy flag is insufficient to associate an export with its bytes: its
local download path ends the blocking action immediately after starting an async
conversion. Save tracking therefore wraps the final `x2t.convertFromBin` method,
after the worker proxy has been installed. It captures the serialized revision,
associates the returned binary object with that revision, and queues that state
only when `downloadFile` actually posts the corresponding stream. Failed
conversions, dismissed dialogs and ignored busy requests leave no stream records.
The captured state also identifies any programmatic save request.

Writes for one document are serialized. Monotonic export sequences prevent an
older conversion result from overwriting a newer ordinary save. Other-format
exports keep their independent destination and are never discarded merely because
an ordinary save completed first. Before a queued write starts, and again before
committing its saved state, the original document identity is checked.

History rejects snapshots that cannot individually fit the effective budget before
evicting anything. It trims a document's own older revisions before evicting other
documents. After synchronizing main, latest-version reads retain its reverse document-index
cursor; retention uses its v3 revision-size key index without fetching blob values. These
operations preserve the existing transactional cancellation and file-link cleanup.

## Assistant context and panel ownership

The user request and complete current tool exchange are budgeted first. Optional
reference text is fitted into the remaining UTF-8 request budget. Structured
reference data preserves its scope and explicit partial-read flags, including
Chinese, emoji and JSON-escaped text. Oversized user requests still fail explicitly.
Exact-token providers keep their provider-owned budgeting. Saved/displayed user
messages remain unchanged. All seven existing truncation notices now describe
partial document context as well as omitted conversation turns.

Three responsibilities moved out of `ui/panel.ts`:

- `endpoint-lifecycle.ts`: endpoint connection revisions and disposal;
- `controller-bindings.ts`: native task scope, review callbacks and reference data;
- `settings-view.ts`: settings composition and translated labels.

The cross-origin iframe test now models access to a protected window property,
instead of throwing while jsdom constructs the iframe. The focus test explicitly
models an inactive iframe's remembered focus independently of jsdom's version.

## Regression evidence

Before implementation, new save, context and history regressions failed for the
reported reasons. Follow-up tests also failed before fixes for stale export
records, concurrent disk writes, conversion completion order and mixed-format
output suppression.

A separate Vitest configuration loaded the original `HEAD` implementations through
a test-only load plugin while leaving the checkout unchanged. The updated save,
context and history tests produced 17 failures across four test files against
those originals, confirming that the regression tests detect the removed fixes.

Browser verification uses the installed Google Chrome with video disabled because
the browser/ffmpeg revisions required by the user's updated Playwright package are
not installed. The committed tests remain compatible with the normal project
configuration. The focused browser suite includes real DOCX/XLSX/PPTX save-state
checks, delayed and consecutive writes, file associations, embed dirty-state
round-trips, assistant entry, responsive settings and editable composer behavior.

## Verification before synchronizing main

| Check                              | Result                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Full unit suite with coverage      | 177 files, 5,344 tests passed; every coverage threshold passed                             |
| Coverage                           | Lines 85.32%, branches 79.81%, functions 84.87%, statements 82.84%                         |
| Save-to-file Chrome suite          | 9 passed, including consecutive writes and DOCX/XLSX/PPTX dirty state                      |
| Other focused Chrome cases         | 12 passed: embed dirty state, assistant entry and composer behavior                        |
| Lint / TypeScript / formatting     | Passed                                                                                     |
| Production build / diff whitespace | Passed                                                                                     |
| Independent source review          | Approved after addressing conversion attribution, write order and mixed-format regressions |

The initial combined browser run had 20 passes and one new fixture assertion
failure: Word automatically capitalized “first” to “First”. The assertion now
accepts that native capitalization while still verifying both saved versions;
the complete nine-case save suite then passed. This required no product-code
change. Full multi-browser, Docker/Pages and corpus suites were not run.

The build retains its existing large WebLLM chunk and Anthropic SDK browser-module
externalization warnings. Unit tests retain the existing asynchronous rejection
warnings. These were not introduced by this change.

## PR integration

The follow-up requests one PR with multiple commits, one feature per commit.
Seven commits separate tooling/fixture compatibility, save protection, runtime
context budgeting, history budget protection, bounded recovery-read regression
coverage, panel responsibility extraction and documentation.

The branch was replayed onto main at `03e6b7cd`. Its v3 key-only retention,
latest-snapshot cursor, bounded reference serialization, request-scoped native
tool binding, request queue, conversation isolation, speech drafts and existing
model-cache settings owner are preserved. The panel extraction now delegates
submitted native request bindings to `controller-bindings.ts`; it does not restore
the obsolete controller-wide native tool preparation. This branch adds no schema
migration. The latest-read change was absorbed by main, so its commit adds the
regression test instead.

Integrated validation after syncing main:

| Check                              | Result                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| Full unit suite with coverage      | 201 files, 5,879 tests passed; every coverage threshold passed                 |
| Coverage                           | Lines 87.96%, branches 82.44%, functions 87.55%, statements 85.58%             |
| Lint / TypeScript / formatting     | Passed, including rebuilt workspace declarations                               |
| Production build / diff whitespace | Passed                                                                         |
| Independent source review          | Approved after correcting a merge syntax error                                 |
| Focused Chrome E2E                 | 21 passed: 9 save, 3 embed dirty-state, 5 assistant entry and 4 composer cases |
