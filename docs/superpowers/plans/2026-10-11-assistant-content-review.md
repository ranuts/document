# Assistant content and review implementation plan

> Execution: native, in the current session. The user approved all five directions and requested implementation, verification, commit and PR.

**Goal:** Make document writing, reading and review useful across supported editors while keeping the existing components and theme.

**Architecture:** Reuse the existing editor-scoped tool registry, frozen targets, inline review and native history. Extend explicit content formatting at the Word adapter; measure presentation text with the bundled native layout engine. Presentation feedback belongs in the assistant host, not in provider protocols or the generic chat component.

**Tech stack:** TypeScript, ranui, existing theme tokens, marked, ONLYOFFICE, Vitest and Playwright.

**Spec:** The five approved directions: formatted writing, compact review, truthful reading scope, accessibility and task-specific model acceptance.

## Scope lock

| Assumption                                                             | Evidence                                             | Status                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------- |
| Preserve existing components/theme and avoid private code              | User instruction                                     | Confirmed              |
| Word insert_text currently converts plain text to escaped HTML         | tools.ts:49                                          | Code fact              |
| Presentation content currently uses fixed 28/18 pt title/body boxes    | presentation-content.ts:140                          | Code fact              |
| Detached native shape layout exposes actual text height in millimetres | Browser probe: 228.6 mm of text in a 70 mm box       | Runtime fact           |
| All transports share createDocumentAgentTools and receipt callbacks    | document-agent-tools.ts:14; ui/panel.ts:1355,1915    | Code fact              |
| Existing read tools have different actual scopes                       | tools.ts:168,207; office-tools.ts:116; pdf-tools.ts  | Code fact              |
| 4B sometimes repeats writes after success                              | assistant-format-regression.md previous native trial | Known model limitation |

Allowed: agent tool/content/context/review adapters and their consumers; generic chat activity markup; seven shared translations; existing theme CSS; focused tests, product guides and acceptance records. Exclude generated isolated browser builds from TypeScript source discovery; preserve all source checks. Preserve previous uncommitted assistant repairs.

Untouched: private repositories, bundled vendor code, dependencies, cloud deployment, unrelated editor functions and new Agent frameworks.

Compatibility: plain text remains literal by default; HTML from models is never executed; no silent connection/download/sending; frozen document/worksheet targets, read-only protection and one native Undo per operation remain. No automatic re-execution after partial success. All languages remain supported.

## Tasks and acceptance

### 1. Word formatting and presentation fit

Files: tools.ts, new word-content.ts, document-tool-action.ts, ui/document-draft.ts, ui/panel.ts, presentation-content.ts; corresponding unit and real editor tests.

- [x] RED: formatted Word content retains headings/list items, literal plain text is unchanged, hostile HTML/links remain inert.
- [x] Extend insert_text with optional format: plain | markdown (default plain). Serialize a safe Markdown token subset and derive the expected rendered text from the same content model for independent native readback.
- [x] Use DocumentToolAction for generated draft handoff; preserve the body-only artifact boundary.
- [x] RED: long slide content is preserved across fitted pages; one Undo restores the original deck. Failure/cancellation rolls back the owned group.
- [x] Fit title/body using actual native layout; keep readable font sizes, paginate overflow without dropping characters; report added pages.
- [x] GREEN: Word DOCX formatting/export/Undo and native PPT long-content layout/readback/Undo.

### 2. Review and scope feedback

Files: ui/change-review.ts, ui/action-preview.ts, document-tool-action.ts, new ui/read-receipt.ts, ui/panel.ts, tools.ts, office-tools.ts, shared i18n and assistant.css.

- [x] RED: formula source and displayed value are distinguishable; finished review retains location and Undo guidance, failed writes never gain a success receipt.
- [x] Keep the existing inline diff. Label calculation results separately from formulas. Add location and native Undo guidance to verified records only.
- [x] RED: read receipts distinguish Word body, selection, explicit cell ranges, slide text and PDF pages; truncated reads say they are partial.
- [x] Reuse the same receipt formatter for native/schema transports; avoid duplicating entire read content in a progress summary.
- [x] GREEN: real document reads retain correct scope without moving selection.

### 3. Accessibility and task acceptance

Files: packages/chat-ui/src/chat-view.ts, existing composer/review tests, docs/assistant-format-regression.md, seven product guides and CHANGELOG.md.

- [x] RED: disclosure marker and its text share one line; completed review has meaningful reading order; keyboard focus returns to the editable draft, status is polite and atomic.
- [x] Use semantic inline summary content and existing controls; verify keyboard language menu, Escape, focus restoration, narrow layout and accessibility snapshots.
- [x] Separate host correctness from native-model task choice, repeat/cancel and unsupported-operation acceptance; keep experimental designation unless actual task evidence meets every criterion.
- [x] Rebuild shared/core/chat packages, run full units, TypeScript and production editor regressions. Reverse-disable formatted insertion and observe its native failure; retain the other new tests’ original RED evidence.
- [x] Update ordinary-language product help; record any unavailable real screen-reader or speech-quality checks without claiming a pass.

## Simplest alternatives

- Word: extend the existing explicit tool instead of inventing a rich-document framework. Default plain protects literal requests.
- Slides: native measurement instead of guessed character counts or browser font estimates. Additional pages preserve readable text instead of truncation.
- Review: an existing inline record instead of new cards, modals or duplicate approval controls.
- Scope: one shared host formatter instead of provider-specific presentation.
- Reliability: task evidence and existing execution guards instead of increasing model claims based on JSON validity.

## Review focus

- Mixed CJK/Latin, emoji and long unbroken text: preserve every character and fit the actual slide shape.
- Model HTML/image/link payloads: no active content or external-resource fetch during Word insertion.
- User edits or switches documents during a review: never locate/write to a foreign target.
- Truncated or unavailable reads: no claim that the entire file was read.
- Busy/failed/partial tasks: preserve the draft and report verified effects only.

## Submission checklist

1. Prepare a clean non-main branch and explicit staged files after verification.
2. Run GitHub PR pre-check.
3. Review the complete diff and downstream contracts.
4. Resolve findings and reverify.
5. Prepare an English Conventional Commit PR title.
6. Push, create PR and attach it to this task.
7. Clean temporary review files and report evidence/limitations.

Implementation notes: table formatting and structured insertion under Track
Changes fail before writing. Native read operations continue compound tasks and
remain valid in readonly editors. Unchanged write arguments are not duplicated
in results; user revisions remain explicit. Fresh independent review approved
these repairs. Full submission checks are recorded in assistant-format-regression.md
when their final runs finish.
