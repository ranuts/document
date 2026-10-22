# Assistant workbench redesign implementation plan

> **For agentic workers:** Use subagent-driven-development for isolated Chat/Markdown and
> Artifact implementation; root owns shell/composer integration. Independent spec and code/
> visual review must follow. Preserve behavioral/security checks and inspect real media.

**Goal:** Redesign Document's actual assistant into a coherent document-first conversation
and artifact workbench, retaining its functional lifecycle and producing reviewable evidence.

**Architecture:** A small presentation-layout owner extends the existing panel width and
workspace owners. ChatView remains generic; artifacts retain their store/draft/refinement
owners. Shared Markdown remains one safe renderer. No new request/storage engine.

**Tech stack:** TypeScript, existing ranui builder/components/tokens, Vite, Vitest, Playwright.

## Chunk 1: Independent contract and baseline

- [x] Read the ranui plugin/owners and current host contracts; inspect actual editor captures.
- [x] Present and record the workbench direction and task/safety boundaries in the paired spec.
- [x] Independent review of spec/integration and address concrete findings before implementation.
- [x] Add a real-browser failing test for explicit expansion, dual chat/artifact visibility,
      preserved draft/mode on collapse and one guarded return. Use fixture transport only, never
      fake product UI. Wait for a real stream before advancing it; use `Hello` for an ordinary-chat
      fixture, because document-bound prompts exercise a separate native capture lifecycle.

## Chunk 2: Parallel bounded owners

### Chat and Markdown owner

Files: `packages/chat-ui/src/{chat-view,styles,markdown-styles,markdown-presentation}.ts` as
needed; meaningful co-located generic tests under `test/unit/`.

- [x] Read relevant existing ChatView/Markdown tests and establish independent expectations.
- [x] Add/regress observable behavior before functional changes, run the failing test, then
      implement. A pure visual change is verified in real browser, not a mirrored CSS-string test.
- [x] Redesign conversation measure, rhythm, user messages, inline phase/reasoning/answer
      hierarchy and restrained actions; preserve virtualization, reader anchoring and selection.
- [x] Redesign shared code/table presentation without weakening safe links/literal media,
      parser bounds, clipboard integrity, native selection, scroll or lifecycle/disposal guards.
- [x] Test delayed copy completion across stream changes and reduced-motion state where changed.

### Artifact owner

Files: `lib/agent-plugin/ui/{artifacts-view,artifact-workflow,artifact-presentation}.ts` as
needed, `styles/assistant-artifacts.css`, relevant artifact unit tests.

- [x] Test meaningful draft/version/navigation behavior before functional changes.
- [x] Build one compact object toolbar, calm reader/editor canvas and coherent command/footer
      region. Keep object identity clear without competing title stacks; never remove user body text.
- [x] Preserve source data, explicit version saves, dirty cancel/discard, conflicts, refinement
      acceptance, export and native document review. Expose structure for the shell's split layout.
- [x] Run relevant artifact state/interaction tests; leave store/schema/inference untouched.

### Root shell/composer owner

Files: `lib/agent-plugin/ui/{panel,panel-workspace,panel-resize,speech-input}.ts`, a small
`panel-layout.ts` if needed, `styles/assistant.css`, seven locale messages/types, shell tests.

- [x] Implement explicit expand/collapse with existing localized expansion label and a matching
      collapse label. Separate temporary expanded width from persisted dock preference.
- [x] At 840px+ assistant width, show Chat and Artifacts as independent columns. Use selected
      single surface below that width. Preserve scroll/draft/focus and correct current-state labels.
- [x] Keep the artifact-owned guarded return; wide mode places it with the artifact surface,
      compact mode uses the existing single shell return slot. Do not clone its operation.
- [x] Group voice language and privacy in a reachable voice-options disclosure, keeping source/
      microphone/Send discoverable and Stop independently reachable. Test real popup keyboard/focus,
      language selection, denied permission, active dictation, narrow reflow and draft preservation.
- [x] Remove only redundant first-use helper rows; preserve actual task actions and recovery.

## Chunk 3: Integration, craft and delivery

- [ ] Build shared workspaces once after bounded edits; avoid parallel dist/result mutations.
- [ ] Run meaningful new browser tests against the built actual editor; retain existing source,
      streaming, Markdown safety, reasoning, queue, dictation, focus and artifact regressions.
- [ ] Adapt obsolete presentation assertions to the independently declared new design contract;
      demonstrate relevant visible-text drift/overflow or async-feedback mutation rejection.
- [ ] Capture before/after full editor and panes: dock/expanded artifact, streamed reasoning/
      answer, draft/stop/error, table/code, edit/version/refinement and narrow layouts. Include
      light/dark, English/Chinese/Portuguese, keyboard/touch and reduced motion where relevant.
- [ ] Record continuous actual interactions; bind source/dependency/build/media/state hashes.
      Inspect screenshots and video frames/playback, then independent visual and code review.
- [ ] Run `pnpm run lint:ts`, `pnpm run format:check`, meaningful unit tests and affected
      real-browser suites. Update the canonical application design contract and evidence summary.
- [ ] Only after local visual/interaction review passes, commit/push to PR #290 and rewrite its
      title/body for the final redesign. Inspect head-specific CI. No merge/package publication.
