# Nightly interaction stability

The cross-browser run for PR #287 (`39249862820`) passed after retrying three
cases. This follow-up treats those retries as evidence to investigate, rather
than increasing their timeouts or retry budgets. PR #287 was merged before
starting this branch, against main at `6525b804`.

## Findings

### Sources added during history restoration disappeared

Firefox's source-reference case found the attachment row, filled its search
field, and then lost the row while trying to open its disclosure. The trace
shows a permanent disappearance, not a temporarily moving click target.

`ReferenceSources.forget()` cleared the conversation maps while leaving the
active entries reference detached from those maps. An attachment added during
the asynchronous startup restore went into that detached map. Selecting the
same conversation after restoration created an empty map and lost the new
attachment. The correction belongs to reference ownership, rather than a
longer click timeout or a different locator.

### Historical transcript setup raced native scroll delivery

WebKit's composer case set `scrollTop` to zero and immediately changed layout.
Reading back zero did not establish that the native scroll event had run and
updated the transcript's following state. Subsequent composer resizing could
therefore still follow the latest message. Another nightly run (`39338214745`)
showed the same failure for PDF, rather than DOCX.

The test needs to establish a historical reader through an actual interaction
and its visible processed-scroll signal before testing layout preservation.
Following new content and preserving a detached reader remain separate cases.

### Firefox canvas clicks preceded keyboard-capture focus

The save-overlap case failed before installing its held-conversion fault:
the first document text read remained empty after inserting `Recovery version`.
The SDK defers its input-area focus through a zero-delay task on Firefox.
A completed canvas click therefore does not establish that trusted text input
will reach the document. Save setup must focus the real SDK input area and
verify it is focused and editable, while retaining the exact document-content,
disk-content and recovery-ownership assertions.

## Boundaries and acceptance

- Keep source ownership scoped to the selected conversation. Clearing existing
  references must still invalidate captured requests; switching conversations
  must never share attachments.
- Preserve the production chat following and layout behavior. Synchronize the
  E2E reader setup with actual interaction completion.
- Preserve trusted browser input and the real editor/save/conversion path.
  Do not patch the vendor SDK for a test preparation race.
- Do not increase timeouts, retries, error allowlists or skip affected engines.
- Reverse each regression against the old behavior, run focused cross-browser
  checks without retries, then run the PR gates and complete nightly browser
  matrix with the slow-network budgets.

## Reverse validation

- With the old reference ownership implementation, both parameterized unit
  cases (`forget()` and forgetting the selected conversation) lose `New notes`
  when the same conversation is selected again. The browser regression holds
  initial history loading until after attach/search; releasing it loses the
  attachment row before the fix.
- With only the visible processed-scroll gate removed, the retained delayed
  native-scroll scenario fails twice in WebKit: the historical offset becomes
  `1449` instead of `0` after resizing. The corrected setup uses native Home
  navigation and waits for the visible jump-to-latest control before resizing.
- With only explicit SDK input focus removed from the save setup helper,
  holding Firefox's deferred focus task leaves the exact document text empty
  instead of `Recovery version`. The regression verifies that the task was
  intercepted and the canvas still owned focus before attempting trusted input.

These controls delay the relevant event or storage boundary, not the assertion
deadline. The ordinary retry policy and all existing timeouts remain unchanged.

## Local verification

- Lint and TypeScript checks passed. The full format check also verified all
  1511 immutable evaluation artifacts.
- Full coverage run: 252 test files, 6801 tests passed. Statements 87.79%,
  branches 83.94%, functions 88.77%, lines 90.25%; module thresholds passed.
- Source unit suites: 20 passed. The gated source scenario passed twice each in
  Firefox and WebKit, without retries. The complete sources/artifacts spec
  passed all 8 cases in Chromium.
- Firefox's complete save spec passed all 12 cases. The final deferred-focus
  regression and held-recovery overlap passed together; the original overlap
  also passed in Chromium.
- Composer layout/navigation passed all 24 cases across four formats, three
  repetitions and WebKit/Firefox. The delayed-scroll fault passed twice per
  engine and once in Chromium, with retries disabled.

Remote checks are recorded on the follow-up PR for its exact submitted head.
