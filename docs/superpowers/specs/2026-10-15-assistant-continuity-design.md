# Assistant continuity and responsiveness

## Goal and authorization

The user requests one PR with commits divided by function: voice repair,
conversation history interaction/design, actual latency and jank reduction,
continued submission during a response, and responsive Stop. They chose to align
with ChatGPT rather than expose implementation choices. Continue PR #271; do not
create another PR or reproduce already merged work from #268/#270.

Default follow-ups queue in order while a local model runs. Separate Stop and
Send now actions keep their meaning. This reproduces a continuous-input product
experience; it does not claim native mid-token steering for browser models.

## Evidence and scope lock

| Fact                                                                       | Evidence                                    | Consequence                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| The current PR contains voice cancellation repair only                     | PR #271, head 91ad1dd                       | Preserve that commit and extend this PR.                                             |
| History searches clone message arrays and rebuild all rows on every input  | history-list.ts:34 and sessions.ts:165      | Move full-text search off the interaction path and bound rendered rows.              |
| WebLLM already uses a dedicated Worker                                     | webllm.ts:439                               | Do not add a second inference engine or change models.                               |
| Local generic requests classify intent before answering                    | panel.ts:1923                               | Remove calls only where host provenance or a conservative exact match proves intent. |
| Ordinary controller requests eagerly read document bodies                  | panel.ts:1422 and request-context.ts:31     | Read only relevant context, while keeping explicit document reads grounded.          |
| The composer rejects submission while running                              | chat-view.ts:593                            | Add optional queue hooks and host-owned per-conversation state.                      |
| Stop currently waits for host lifecycle and interrupted Markdown rendering | chat-view.ts:155, 413 and controller.ts:215 | Acknowledge once, freeze obsolete output and defer heavy presentation.               |

Allowed: assistant UI/history/session modules, request context/intent/controller,
document-tool-action lightweight target capture (preserving write verification),
chat-ui source/public docs, relevant worker/scheduler modules, seven locale
tables/types, focused unit/E2E regressions, changelog and these task records.

Unchanged: conversation database schema and persistence preference, model/provider
defaults, dependencies, editor mutation/confirmation contracts, document files,
immutable evaluation artifacts and unrelated website/README marketing work.

No current hardware model latency has been measured. Separate interaction
feedback time, first useful content, model call counts, context bytes and UI long
tasks in evidence. Do not describe simulated endpoint timing as GPU performance.

## History experience

Keep a restrained history surface with clear title, search, date groups and a
recognizable active conversation. Search results include a short matching text
excerpt when useful. Distinguish no conversations from no search matches. Keep
saving/import/export/deletion data controls secondary and existing confirmation.
All actions remain keyboard accessible in light/dark and narrow sidebars.

Render an initial bounded page of rows and offer more without discarding matches
or changing full export. Avoid duplicate row rebuilding on unchanged state and
preserve focused conversation identity. Hidden history does not rebuild DOM on
every saved turn. Search uses a dedicated Worker with latest-query/revision
validation; no Worker availability/failure may lose history or wedge search.
Use cancellable, bounded idle chunks for optional index preparation, with a
fallback and timeout. Idle work never delays explicit typing, Stop or Send.
The in-memory session store remains authoritative; do not repeatedly clone every
conversation's full history per keystroke or create another persistent store.

Operational limits: the synthetic acceptance collection has 1,000 conversations,
eight messages per conversation and 512 characters per message. Initially render
at most 40 rows; incremental loading adds at most 40. Unchanged queries must not
clone message arrays or repost the corpus. Initial extraction and fallback search
yield in bounded chunks. A Worker that never replies must time out and fall back,
as must construction, error and messageerror failures. Revision and query identity
reject stale responses. Hidden views retain dirty state without DOM rebuilding;
reactivation refreshes it. Pagehide/disposal cancels idle work and Workers.

## Stop and continuous input

Stop is a separate compact control. First activation immediately shows truthful
stopping feedback and prevents further old-answer deltas from appearing.
Repeated clicks do not repeat cancellation. Keep the partial answer marked
incomplete, source text intact, next draft and focus stable. Do not synchronously
parse a long Markdown answer in the Stop click handler. Do not kill/reload a
healthy model merely to animate cancellation; GPU cleanup may outlive UI feedback.

During a response, Enter/Send adds the draft to a visible pending list. It is
not yet an executed user turn. Allow removing an entry, taking it back for
editing without overwriting another draft, and explicit Send now. Preserve FIFO
order and never run two inferences concurrently. Natural successful completion
advances the queue. Stop/failure pauses it; an explicit continuation resumes it.
Send now can promote an entry and request cancellation, then waits for the active
run to settle before submitting it. Waiting for change review cannot silently
advance another document operation.

Queue state is owned by the host, keyed to conversation and current document
scope; ChatView exposes optional generic hooks only. Switching conversations
must not execute an old conversation's queue. Bind queued document requests to
the enqueue-time target, session and read-only state. An invalid scope pauses and
preserves the request for explicit confirmation, never silently retargeting a
write. Queued text is not saved as completed conversation history; no storage
schema or automatic cross-page execution is introduced.

Each execution returns a turn identity and explicit settled outcome: success,
stopped, failed, limited, review-pending or superseded. A resolved Promise alone
cannot advance the queue. UI acknowledgement and provider drain are distinct;
the provider remains serialized even if abort releases its caller early. Late
finalizers cannot clear another turn. Provider changes invalidate pending scope.

When paused, sending a new draft queues it without resuming older work. Resume
continues FIFO; Send now promotes the selected entry and explicitly resumes it.
Editing restores only into an empty composer; otherwise it remains pending with
feedback. Switching away pauses that session and returning requires Resume.
Deleting or restoring a session discards its volatile queue. Invalid document
scope requires explicit request restoration and rebinding; it never auto-retargets.
Ordinary freeform messages also capture a lightweight scope before routing,
because their eventual document intent is not known when queued.

## Actual request performance

Use exact, conservative shortcuts for unambiguous greetings/capability questions;
ambiguous text, negation, refinements and writes retain semantic routing. Avoid
eager whole-document reads for generic chat and native tools that can explicitly
read their document. Preserve bounded selection reference data and exact PDF
page scope where needed.

Trusted host read-only tasks may use one answer inference with actual bounded
selection/document/page data, zero mutation tools and current-target guards
before output and completion. Keep truncation/unavailable information explicit.
Writing remains reviewed. Edited staged prompts lose their trusted metadata;
provider/consent/readiness/history/cancellation behavior remains the same.

Separate lightweight scope identity from mutation verification snapshots. Exact
greetings and ordinary generic chat must perform zero whole-body SDK reads,
including implicit reads in captureDocumentToolTarget. Capture expensive write
verification only on an actual write path, before its first asynchronous work,
without relaxing identity, interaction or readback checks.

Trusted read provenance is host-created metadata with an explicit read task ID
and selection/document/page scope; task='tools' alone is insufficient. Eligible
cards are explain-selection, analyze-sheet, summarize-document and explain-slide
(map to existing task IDs during implementation), plus exact PDF-page readers.
Editing or restoring a task for editing revokes trust. Bounded source capture
must distinguish missing/unavailable/truncated text, and unavailable sources
produce scope feedback rather than ungrounded answers. Trusted reads require one
answer inference, zero classifier/planner inferences and tools={}. Exact greeting
routing skips classification but retains its answer inference.
Measure skipped classification/planning calls and bytes/SDK reads with held
providers and synthetic documents. Do not use broad regex classification as a
replacement for the existing semantic router.

## Acceptance

- History: large synthetic collections, full-text search, stale Worker results,
  fallback, bounded DOM, no unnecessary history clones, focus, deletion and export.
- Stop: held provider, delayed deltas/finish, repeated activation, long answer,
  draft/focus preservation, no stale writes and Stop-then-next question.
- Queue: several messages in order, edit/remove/send now, pause/resume after Stop
  and errors, conversation switch/deletion, review hold and stale target checks.
- Performance: call counts, SDK read counts, request context size, synthetic UI
  responsiveness before/after; actual GPU TTFT remains explicitly unmeasured.
- Stop's next animation frame must expose stopping feedback without parsing the
  partial answer in the event handler; synthetic 100KB partial text must not
  introduce a Stop-handler long task (50ms). Record hardware/browser and timings.
- Shared ChatView without queue hooks retains its existing submit/Stop behavior.
- Run required lint/typecheck/format/build, focused and full units, then serialized
  real-editor E2E. Inspect light/dark, 320/432/520 widths, Chinese and reduced motion.

## References

- [ChatGPT desktop follow-ups](https://learn.chatgpt.com/docs/prompting)
- [Claude Code queued messages](https://code.claude.com/docs/en/interactive-mode)
- [Worker limitations](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [Idle callback scheduling](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback)
