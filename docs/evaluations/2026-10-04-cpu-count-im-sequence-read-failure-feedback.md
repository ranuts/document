# Range read failure guidance

The built Excel IM now maps the stable `officeRangeReadTooLarge` error to concise Chinese or English guidance to read a smaller range. Single-region and combined-region text limits use the same code. Restored error history preserves the formatted guidance.

## Actual browser verification

Ran `probe-cpu-count-im-sequence-read-failure-feedback.mjs` against the current build on port 5193 using the cached CPU fallback. The request reads A1:B4 and then sets B2 to 99. Three native Excel cells contained 32,767 characters each (98,301 total), exceeding the 80,000-character range output limit.

The visible error was “The range contains too much text. Read a smaller range and try again.” All A1:C4 values stayed equal to the initial snapshot, no later write executed, and no success message or preview appeared. No page errors occurred; the build hash stayed unchanged during the probe. This verifies this bounded failure case, not arbitrary multi-step cancellation or semantic model fidelity.

## Checks

Presentation tests cover both languages and restored history. Tool tests cover single-range and aggregate overflow, including individually valid regions. Full unit suite, TypeScript, scoped lint and production build were run; results are recorded in the completion report. Existing asynchronous rejection warnings remain in the full suite.
