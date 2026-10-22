# Document assistant workbench redesign

## User-authorized direction

The user requested a complete redesign of the actual Document assistant, continuing the
approved ran design/plugin direction and permitting incompatible presentation changes.
They require real screenshots and continuous interaction recordings before updating PR #290.
Use the existing request, storage and review lifecycles. This is one product redesign,
not a new assistant backend or a separate demonstration site.

## Evidence and decisions

- Code facts: `panel.ts` composes mutually exclusive workspace surfaces; `panel-workspace.ts`
  owns navigation, `panel-resize.ts` owns width, ChatView owns answers/composition, and
  `artifacts-view.ts` owns version/draft guards. The baseline is `27ddb4c`.
- Runtime facts: actual editor captures show a 432px assistant, a permanently visible voice
  language/privacy strip, and an artifact replacing the conversation. Its object title,
  mode/version row and broad action row compete with the document body.
- References: [Claude artifact workflow](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them)
  supports keeping the result beside the conversation; [ChatGPT content blocks](https://help.openai.com/en/articles/20001246-working-with-writing-blocks-and-code-blocks-in-chatgpt)
  separates reusable writing/code and its applicable actions. Adapt these task relationships,
  not their brand palette or unsupported execution features.
- Owners: ranui plugin routes to DESIGN, INTERACTION and ACCEPTANCE. The installed ranui
  0.5.0 API/source remains authoritative for component use; the new guidance is read from
  the matching ran checkout because it is not yet in the installed npm package.

## Chosen composition

Three approaches were considered: another visual refresh of the single pane; replacing the
editor with an assistant application; and a document-first expandable workbench. Adopt the
workbench: it materially improves the task without discarding the editor or inference owners.

1. **Shell.** One 48px fine-input / 52px coarse-input header, content-sized Chat identity
   and recognizable Artifacts/Conversations/New/Expand/Close commands. Default desktop assistant width is
   480px, with existing pointer/keyboard resize and a 320px minimum. Explicit expansion
   uses at most 1040px while retaining at least 360px for the Office document. Hide Expand
   when narrow input cannot benefit; four remaining icon commands and the content-sized title
   must fit 320px touch. Manual pointer/keyboard resizing exits expansion and deliberately
   updates the dock preference. Window resize only clamps presentation. Do not
   overwrite the user's dock-width preference when entering/leaving expanded mode. Shared content
   rails are 24px on normal desktop surfaces and 16px on narrow 320px/360px layouts.
2. **Two working surfaces.** When Artifacts is selected at an assistant width of at least
   840px, Chat is left and the existing artifact list/detail is right, with independent scrolling. Columns have
   320px/480px minima, a single 1px divider and no decorative gap; distribute extra space 2:3.
   Artifacts remains the selected route while Chat is a visible companion. Selecting Chat
   explicitly returns to the centered reading view. Width-only transitions never call route-leave
   cancellation or artifact refresh; preserve the mounted owner, selected artifact and version.
   At smaller widths show the selected surface and one immediate-parent return. Expanded
   desktop Chat uses a centered column capped at 680px, with prose capped at 68ch. Resizing back
   preserves drafts, selection, reading position, artifact mode and dirty-state guards. If collapse
   hides focused Chat, move focus to a visible destination while retaining the saved selection.
   Relocate the existing artifact-owned guarded Back to its local artifact region in split mode
   and the single shell return slot in compact mode; never clone it or duplicate returns.
   Sources, settings and history retain their existing routes.
3. **Conversation.** An intentional reading measure, 16px body copy on ordinary desktop
   panes, coherent heading/list/table rhythm, compact user messages, quiet answer actions,
   and a purposeful waiting/reasoning presentation. Only provider-exposed reasoning is
   shown. Keep it separate from copied/saved answers; reader expansion and scroll intent
   remain authoritative. Avoid replaying text or animating every streamed token.
4. **Composer.** One framed drafting object, stable Send and independent Stop/queue behavior.
   Sources and microphone remain discoverable. Put voice language and privacy guidance in
   the existing privacy disclosure, extending it into voice options, with a meaningful accessible
   name and reachable language control without closing its parent. Live status and Cancel remain outside
   that disclosure. Preserve its recording, permission, selection, IME and cancellation
   lifecycle. Remove redundant onboarding helper rows, not useful labels or recovery.
5. **Artifact canvas.** A compact object/title/version/mode toolbar, one readable editable
   document canvas and a coherent command/footer region. Keep user-authored body headings,
   raw content and explicit Save version. Preserve version conflicts, dirty confirmations,
   refinement proposal acceptance, export and Review in document. Deletion remains confirmed.
6. **Tables and code.** Use the shared safe Markdown presentation in chat and artifacts.
   Tables get deliberate column padding, quiet headers, numeric alignment and contained
   horizontal scrolling. Code has a compact language/copy toolbar, readable mono metrics,
   stable syntax colors and a distinct reading surface. Preserve tabs, blank lines, trailing
   newline, native selection and scroll across streaming. Bind delayed copy feedback to its
   source snapshot; no invented Run/Preview capability or passive remote media.
7. **Details and motion.** Token-derived neutral surfaces, restrained functional borders,
   visible focus, coarse targets at least 44px. Use interruptible fast transitions for
   expansion/disclosure/press feedback; no theme interpolation, shimmer or decorative
   background animation. Reduced motion preserves every state and action.

## Scope lock

May change: assistant presentation/navigation/resize/voice options in `lib/agent-plugin/ui/`,
`packages/chat-ui/src/`, `styles/assistant*.css`, applicable seven-locale messages/types,
meaningful tests, canonical application design contract and concise evidence docs. Keep shared
owners small; do not grow `panel.ts` into a second state engine. Upstream ran is allowed only
for a reproduced reusable component defect, with its own focused proof and PR update.

Leave provider defaults, inference contracts, request/session identity, queue lease/Stop
acknowledgement, explicit consent, persistence schema, safe renderer policy, native Office
review/Apply/Undo guards, vendor assets and archived evaluations unchanged. No automatic model
calls, downloads, document writes, account features, package publication or merge.

## Acceptance and independent proof

- Actual editor and assistant, not a fake host; deterministic provider events are disclosed
  as transport fixtures, never real-model quality evidence. Retain baseline captures.
- Desktop dock, expanded chat/artifact split, narrow 320/360px touch; English, Chinese and
  long Portuguese; light/dark, keyboard/focus and reduced motion. Test resize while reading
  and editing, route round trips, dirty cancel/discard and no double return.
- Real clipboard equality before/after stream, delayed success/rejection across updates,
  native text selection, long code/table scrolling and no document-wide overflow.
- Real response/reasoning/start/stop/error UI interactions driven by disclosed fixtures, next
  draft and queue behavior; no fabricated reasoning, persistence or completion. External provider
  access is optional. Version/refinement/export/review remain explicit and distinguish their outcomes.
- Independent geometry expectations precede edits. Show seeded drift/overflow or stale
  feedback is rejected, then restoration passes. Preserve existing behavioral/security
  tests; revise obsolete presentation expectations only against this declared new contract.
- Bind media to runtime sources/dependencies, build, state, viewport/theme/locale and hashes.
  Agent visual/code review, automated results and human decisions remain distinct. Real
  screenshots and recordings must be inspected before authorized PR update; no human
  acceptance is inferred. Run relevant build/type/lint/unit/browser gates and inspect CI
  on the new pushed head.
- Walk through tasks informed by _Don't Make Me Think_: recognize conversation/artifact/version,
  find a destination, resume a draft, choose voice language, save a version, accept refinement,
  open document review and recover from cancellation/error. Check clear context, differentiated
  action outcomes and guidance beside the relevant decision. Report the top three observed task
  problems with evidence, impact and corrections, or fewer if fewer were observed. Agent/automation
  walkthroughs are labeled separately from human usability tests and do not establish human
  acceptance. Do not use arbitrary click budgets or counts of aesthetic elements.

The [canonical application contract](../../design-system.md#assistant-application-layout-contract)
owns these geometry and task-acceptance rules. Update obsolete presentation assertions against
that declared contract; preserve the functional, security, source and consent contracts.
