# Interrupted stream after provider failure

The controller persisted visible partial prose on cancellation but discarded it from saved history when the provider threw an ordinary error. The live chat still displayed the fragment and marked it interrupted, so reloading lost content that had been visible.

On a streaming failure with visible prose, the controller now saves that prose with `interrupted: true` and saves the filtered host error. It retains existing behavior for failures without visible prose. Hidden reasoning and raw provider error details are not persisted. The existing history converter and chat view keep the restored fragment copyable and exclude it from the insert button and last completed answer. No additional UI is introduced.

## Verification

The regression first failed because history contained only the user message. After the fix, it checks exact saved messages, safe error filtering, conversion to restored turns, and the actual ChatView consumer: visible fragment, copy available, no insert action, no completed answer. Existing cancellation and post-tool checkpoint tests remain covered.

Full suite: 139 files, 4,515 tests passed, with existing asynchronous PromiseRejectionHandledWarnings. The added consumer initially exposed a missing jsdom scrollTo fixture and an incorrect callback signature; the fixture and signature were corrected. The final consumer run passed. TypeScript, scoped oxlint, and production build passed; existing build chunk warnings remain.

This is a controlled provider-failure regression using the real controller, storage conversion, and chat component. It does not certify real-device memory failures, native document mutations, or model summary accuracy. Broad model fidelity remains unaccepted.

## Independent follow-up review

A scoped independent review of 770f69c found no Critical/Important regression. Runtime completion and tool checkpoints reset the display buffer before subsequent inference, so only the current interrupted segment is appended on failure. A follow-up parameterized regression checks cancellation and ordinary provider failure after a completed tool exchange: one execution, exact assistant/tool-result checkpoint, and one interrupted follow-up with the appropriate host guidance. All 33 controller tests passed; the subsequent full suite passed 139 files and 4,516 tests. TypeScript and scoped oxlint passed. This follow-up changes only tests and this record, so it does not require another product build.

The restored-view assertion establishes that Copy is available; it does not click Copy or independently verify clipboard contents for this specific restored error case.
