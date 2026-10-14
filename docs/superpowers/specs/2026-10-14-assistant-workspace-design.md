# Contextual document assistant workspace

## Approved direction and evidence

The user approved implementing the overall UX/design direction discussed in the
conversation: document-aware entry points, clearer context, stronger answer and
review hierarchy, less uninformative waiting, and direct completion in the editor.
Use one new PR from current main, with functional commits. PR #268 is merged.

Current code facts:

- `panel-context.ts` and `composer-context.ts` already own bounded selection reads
  and event-driven refresh. The welcome view currently offers text hints only.
- `panel.ts` routes ready non-native requests through `resolveRequestIntent`
  before generating an answer or writing proposal. Exact host-selected tasks
  can carry their known intent without this extra model classification.
- `ActionPreview` already owns target validity, comparison, confirmation,
  cancellation, refinement and verified/sent receipts. Improve its composition;
  retain these execution safeguards.
- `ChatView` is editor-independent. The host marks document artifacts; generic
  rendering must never infer write permission from prose or show interrupted
  results as completed artifacts.

No claim is made about actual model latency or answer quality without measurement.

## Experience

1. Open the assistant to see the current document scope and a compact set of
   useful tasks for Word, Excel, PowerPoint or PDF. Selected text changes the
   suggestions. Empty, oversized/unavailable selection and read-only contexts
   must remain honest about scope and supported operations.
2. Clicking a task stages an editable request and focuses the composer. It does
   not invoke a model, download a model, overwrite a nonempty draft, or queue work.
   Explain the staging interaction briefly. Explicit Send starts the operation.
3. A staged task is host-owned metadata, consumed once only if the request and
   captured session/editor scope still match. Edited requests use normal routing;
   stale selection/context gives visible guidance and preserves the request.
   Never skip classification solely by matching arbitrary user-authored text.
4. Preserve current preparation, endpoint consent and local writing consent.
   Ready staged writing tasks avoid exactly one routing model call. Prove this
   with request counts, not an invented percentage or timing promise.
5. Distinguish ordinary answers, document drafts, interrupted output and activity
   with restrained typography, surfaces and labels. Main content remains readable;
   copy and apply retain the original source and completion guards.
6. A pending review shows its actual target and original/proposed changes, with
   one clear Apply decision, Cancel, and a discoverable secondary-actions area.
   Preserve Edit, Refine, Copy and Locate. Completion shows only the actual
   verified/sent outcome, location and existing Undo guidance.

## Scope and ownership

Allowed: assistant UI modules and integration in `lib/agent-plugin/ui/panel.ts`,
`styles/assistant.css`, generic presentation in `packages/chat-ui/src`, seven
locale tables/types, relevant tests, changelog and design/verification records.

Ownership: panel coordinates submission/consent/session state; a dedicated task
entry module owns staged-task provenance and UI; existing context reads remain
single-owned; ChatView owns rendering; ActionPreview owns review state.

Compatibility boundaries: preserve storage formats, provider defaults, explicit
Send, experimental local-writing consent, cloud consent, read-only behavior,
selection bounds, model/tool cancellation, target validity and truthful receipts.
No vendor edits, new renderer dependency, GPU visual framework, background model
calls, synthetic thinking, fabricated audio waveforms or automatic document writes.
Existing browser-local inference continues using WebGPU where supported.

## Visual acceptance

Use the repository's ranui components/tokens. GPUI-native APIs do not apply to
this TypeScript browser UI. Common leading edges, a stable composer and compact
secondary chrome give the document/result space priority. Use CSS/SVG for state
transitions, honor reduced motion, and retain keyboard operation/focus restoration.

Check real editor layouts at 320px sidebar width and default/wide widths, light
and dark themes, long/CJK content, empty/loading/error/read-only states. Review
actual screenshots. Avoid generic welcome screens repeated for every format.

## Acceptance

- Context suggestions update through existing SDK events and perform no model
  call until explicit Send; drafts survive setup, Stop and state changes.
- Host-selected writing request: classification count decreases from one to
  zero; writing still executes once, then waits for review. Edited/stale/session
  switched requests cannot reuse a privileged or stale task hint.
- Real Word: select text, stage polish, Send, review old/new, Apply, verify native
  text and Undo. Exercise a follow-up refinement and Stop/retry.
- Excel/PPT/PDF suggestions describe only available scope; read-only/oversized
  selection does not promise unsupported mutation.
- Copy/apply/interrupted/restored result semantics and history/speech regressions
  remain passing. Reverse-disable new behavior to prove regressions fail.
- Full unit suite, format, lint/typecheck, production build and appropriate real
  editor E2E pass before push/PR. Physical model quality and microphone accuracy
  remain separate acceptance surfaces.
