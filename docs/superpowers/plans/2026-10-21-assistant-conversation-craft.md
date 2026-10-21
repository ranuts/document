# Assistant Conversation Craft Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Bring the complete sidebar conversation, composer, public reasoning and artifact workflow to a coherent, task-centered completion level, accepted through actual screenshots and recordings before PR updates.

**Architecture:** Keep request, storage and document-review owners intact. Separate public reasoning from answer text at the transport boundary and reuse ranui reasoning/disclosure and the existing chat package’s safe Markdown renderer. Reduce application chrome and compose existing host controls into the relevant task surfaces.

**Tech Stack:** TypeScript, ranui0.5 Web Components/builder/tokens, ChatView, Vitest, Playwright, Vite.

## Chunk1: Implement owned behavior and composition

### Task1: Public reasoning sideband

Files: packages/agent-core/src/llm/{types,openai-format,openai-stream,openai,ollama,gemini,anthropic}.ts; runtime.ts; runtime event types as owned there; lib/agent-plugin/ui/controller.ts; document-read-answer.ts; targeted tests.

- [x] Write failing adapter/runtime/controller tests for explicitly returned reasoning, separation from answer/history and ignored late callbacks.
- [x] Add optional fifth provider chatStream argument onReasoning; normalize OpenAI-compatible reasoning_content/reasoning, Gemini thought text and Anthropic exposed thinking events without exposing signatures/redacted/internal blocks.
- [x] Forward a reasoning_delta runtime event and optional controller onReasoningDelta callback under existing lifetime guards. Expose optional reasoning callback in document-read-answer. Keep model request defaults unchanged.
- [x] Run affected unit cases and package build. Independently review spec then correctness.

### Task2: ChatView/composer/answer craft

Files: packages/chat-ui/src/{chat-view,types,styles,index}.ts; package usage guide; targeted unit cases.

- [x] Add failing tests for appendReasoningDelta/endReasoning, reader-owned disclosure state, bounded reasoning, abort/clear/dispose and no copy/save/apply/context contamination.
- [x] Reuse r-reasoning. Add public methods appendReasoningDelta(text), endReasoning({interrupted?}); conclude on first answer/end/stop. Do not fabricate absent reasoning. Preserve reading position and actual activity announcements.
- [x] Refine composer, transcript typography/action states, artifact-result identity and compact progress presentation. Maintain IME, drafts, editable next draft, explicit Stop and queue semantics; avoid per-token animations.
- [x] Run affected package tests/build and independent spec/correctness review.

### Task3: Artifact reader/editor workbench

Files: lib/agent-plugin/ui/{artifacts-view,artifact-presentation,artifact-workflow}.ts; a dedicated owned artifact style file if warranted; targeted unit cases. Shared product translations remain root-owned.

- [x] Write failing tests for preview/edit, version selection with dirty draft, cancellation and export/review semantics.
- [x] Build readable text preview with the shared safe chat Markdown renderer, an explicit edit mode, compact coherent toolbar/version/actions, source disclosure for structured content and nearby deletion confirmation with safe focus.
- [x] Preserve all storage/draft/schema/native-document-review guards; do not autosave or infer artifacts from prose.
- [x] Provide any new label keys/defaults for root localization; verify focused units and independent reviews.

### Task4: Host shell and contextual entries (root integration)

Files: panel.ts, panel-workspace.ts, task-entry.ts, workspace-labels.ts, styles/assistant.css and optional owned style sheet, shared i18n types/messages, affected navigation integration tests.

- [x] Reproduce current two-row chrome and automatic settings routing in acceptance; assert the new one-row task-centered contract independently.
- [x] Place Chat/Artifacts/Conversations in the single compact header. Move actual model/settings trigger to composer context; Sources remains near composition. Keep all routes operable through real user paths.
- [x] Start in Chat without preparing models. Wire real reasoning callbacks in controller and direct read paths to ChatView under existing request lifetime checks.
- [x] Align surrounding settings/source/task details with the new hierarchy and update all product locales. Avoid a second token/motion vocabulary.
- [x] Update tests to use the actual revised navigation paths, preserving behavioral coverage; do not weaken assertions/timeouts/retries to mask failures.

## Chunk2: Browser craft acceptance and delivery

### Task5: Actual walkthrough, motion and upstream ownership

- [x] Build once and run the affected tests serially against that build. Keep heavy capture and E2E runs sequential.
- [x] Capture baseline/current representative panes and deterministic streamed reasoning/answer/artifact workflows in light/dark, English/Portuguese, desktop/touch/narrow states.
- [x] Record normal and reduced-motion flows, interruption/reversal, reader scroll, focus return and artifact preview/edit/continue. Inspect actual frames, not only video creation success.
- [x] If a ran component defect is reproduced, fix its owner and add library-level failing/passing coverage; verify local consumed package rather than hiding it in host CSS. Do not publish a package without explicit release authorization.
- [x] Independent visual/spec and code-quality review; fix findings and repeat only affected checks/captures.
- [x] Update the local design contract/report and provide scoped evidence/remaining limits. Commit/push/update PR290 only after actual screenshot/recording acceptance; attach any created upstream PR. Do not merge or publish.
