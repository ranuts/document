# Assistant repair: grounded tools and outcome verification

The user has authorized implementing and validating the reported Word, Excel,
model lifecycle and dictation problems. This document records the implementation
boundary, not a claim that acceptance has passed.

## References and decisions

- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling):
  expose structured tool definitions, execute in the application, return tool results.
- [Anthropic tool design](https://www.anthropic.com/engineering/writing-tools-for-agents):
  describe scope and errors clearly and keep tool responses useful and bounded.
- [Anthropic agent evaluations](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents):
  assess environment outcomes as well as the execution trace.

Reuse the provider-neutral runtime and existing editor adapters. Native function
calling is appropriate for providers that support it; schema-constrained planning
is the existing fallback for browser models. Neither model prose nor valid JSON
proves that an operation succeeded. The application validates scope, permissions,
parameters and editor readback. Unsupported requests produce an honest limitation.

## Evidence and scope

Code inspection: ordinary panel chat supplies an empty tool registry and selection
metadata; the runtime already implements tool-call/result round trips. Chat apply
actions currently accept every completed assistant answer. Excel native writes
currently accept a single cell. These are application integration gaps, independently
of the model's reasoning quality.

Allowed: agent-plugin orchestration and native adapters, agent-core contracts,
chat-ui artifact presentation, localized messages, assistant styles and relevant
tests. Preserve local-first defaults, explicit cloud destination selection, stored
conversations, read-only protection, cancellation ownership and native Undo.
No vendor SDK edits, silent cloud fallback or arbitrary generated code execution.

## Implementation and acceptance

1. Bound, non-destructive Word/Excel/PPT context with explicit read scope,
   truncation and failures. Empty selected cells must not show an empty preview.
2. Semantic task selection backed by available editor tools, including natural
   requests that do not begin with an action keyword. Preserve cancellation and
   stale-document checks throughout planning and execution.
3. Separate generated document artifacts from conversation prose. Write only
   artifact bodies, with native formatting and verified results; ordinary replies
   and success receipts have no write action.
4. Add bounded spreadsheet bulk operations using native transactions and readback.
   Creating 1–100 from A1 must yield numeric A1:A100 and one Undo restores the
   previous state. Overwrites and destructive operations need scope confirmation.
5. Validate cached versus active model states and simple dictation into editable
   drafts, including unsupported browsers, no-result and permission errors.
6. Run regression tests, lint and formatting, then real editor acceptance for
   reads, writes, Undo, cancellation, stale scope and read-only state. Evaluate
   the default model separately; mocked tests do not establish model quality.

The simplest approach is to reuse the existing runtime, schema planner, preview
and native write pipeline. A new agent framework or more permanent UI controls
would not resolve these integration gaps.

## Verification record (2026-10-11)

- Full regression: 160 files, 4844 tests passed. Type checking, archive-aware
  lint and formatting passed. No new absolute user paths in the tracked diff.
- Real local Qwen3 1.7B / WebGPU: generated a Word body, inserted only that body,
  read the actual text, cleared it after review, and restored it with one native
  Undo. Reading again after Undo returned the restored text.
- Real Excel: the natural request to create 1–100 wrote numeric A1:A100. CSV
  export matched all 100 values; native statistics showed sum 5050 and max 100.
  One Undo removed the whole range; Redo restored it. An occupied-range request
  produced a review instead of silently overwriting existing data.
- Real PPT: a natural request to add a text box produced a review. Applying it
  created the requested text in a native shape; PPTX export contained the exact
  text. Reading the presentation returned it. One Undo removed the shape and
  the next read correctly reported no readable text. Adding a slide changed the
  native slide count.
- Read-only Word did not offer an executable modification. Unit tests cover
  stale documents/selections, interrupted model calls, transaction ownership,
  partial native failures and rollback.
- Speech interim/final transcripts, editable drafts, no auto-send, no-result,
  permission errors and unsupported engines have automated coverage. Live
  microphone recognition quality was not measured in this environment.

These are integration acceptance results, not a production-quality certification
of the 1.7B model. Complex requests and seven-language model reliability require
an independently scored evaluation set. Success requires the actual editor state,
not an assistant statement that it has completed an operation.
