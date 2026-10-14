# Contextual assistant workspace

## Product direction

The assistant should help complete the current document task. A generic welcome,
undifferentiated replies and a row of equally prominent review buttons made the
next step harder to identify. This iteration improves task discovery, reading
and the existing review decision together.

Contextual tasks stage an editable request. Explicit Send remains the execution
boundary, and Apply remains the document-change boundary. A host-selected task
can carry its known intent, avoiding a separate classification request when its
text, session and original editor scope still match. Arbitrary typed requests
continue through normal routing.

Result identity follows host metadata: ordinary answers, document drafts and
interrupted output retain their separate meaning. Presentation labels never
become part of copied or applied source content. Review gives Apply and Cancel
priority, with Edit, Refine, Copy and Locate in an accessible disclosure.

## Architecture and boundaries

The panel owns submission, preparation, consent and controller/session state.
Task entry owns transient staging provenance; existing bounded context capture
and SDK event subscriptions remain authoritative. ChatView remains independent
of the editor. ActionPreview retains target validity, confirmation and truthful
sent/verified receipts.

No provider default, persistent history format or editor mutation contract is
replaced. Local inference continues to use existing WebGPU support. Visual
feedback uses CSS/SVG and real application state; no simulated reasoning or
decorative GPU renderer is introduced.

## Verification

Specification and code-quality reviews approved each functional chunk. The
integration checks passed 5,448 unit tests in 187 files, `pnpm run lint:ts`
(including workspace and application TypeScript), and `pnpm run build`.

Reverse regressions established that the tests detect missing task staging,
extra classification on trusted tasks, duplicate context capture, incorrect
Chinese writing intent, missing artifact identity and invisible keyboard focus.
Review tests fail against the earlier primary/secondary action layout. Progress
tests detect a wall-clock jump, a timer restarting after renderer-only clear,
and direct task answers retaining the planning phase.

Browser acceptance covers the actual OnlyOffice editor with controlled provider
and speech events. It checks shared leading edges, compact controls, light and
dark themes, 320/432/520-pixel sidebars, narrow Chinese feedback, reduced motion,
keyboard focus, draft preservation, Stop/retry, review and native Undo. Progress
phase changes move the composer by at most one pixel; dictation checks stable
composer and message geometry. The clock is outside live regions so a screen
reader receives phase changes without per-second announcements.

The initial combined run passed 34 cases; four failed while saving screenshots
because the disk was full. After scoped cleanup of ignored generated outputs,
all four reruns passed. The final combined Chromium run passed all 40 cases
with one worker, including Stop/resume, history, dictation, writing, context
events, layout and new process feedback. The repository format check passed;
35 final screenshots were preserved and inspected across the changed surfaces.

Physical microphone behavior, manual screen-reader operation, high browser zoom
and model quality or first-token latency on the user's hardware are not verified
by these controlled checks. No measured model speedup is claimed.

## Browser-local latency follow-up

Source inspection establishes that ordinary non-native requests first await
`resolveRequestIntent` and then start the answer or document task. Trusted staged
tasks avoid that first inference. The ordinary chat controller already forwards
streamed text; its local preflight supplies no native tools, so the runtime's
tool-prose deferral does not explain this path's first-content delay.

`captureRequestContext` attaches readable current-document data, capped at 8,000
characters, even for ordinary questions. Writing transformations await a complete
JSON body and validation before publishing the review. These are concrete places
to measure classification time, input processing and first visible output. This
inspection does not establish the user's actual model, GPU/CPU backend, prompt
token count or latency.

The requested process feedback identifies actual host phases and elapsed waiting;
it does not claim faster model computation or invent a reasoning transcript.
Prompt compression, selective context and validated streamed writing remain
separate performance interventions requiring quality and scope regressions.

## Overall experience assessment

The next action is clearer at each boundary: choose a document task, edit and
send its request, read the answer or draft, review the change, then apply and
undo if needed. Task selection does not execute automatically. Interrupted
content cannot acquire completed-draft authority. Existing history and voice
controls remain compact and preserve the editing surface while their state
changes.

The largest remaining opportunity is time to useful content for ordinary
browser-local questions. Measure intent classification, document input
processing and answer generation separately before changing defaults. A scoped
read-only path could avoid repeated inference, but it must explicitly disable
mutation tools and preserve target, consent and stream validity checks; simply
routing document tasks as ordinary chat would lose those guarantees.

A smaller recovery opportunity is an expired staged task after changing model
or document scope. The current behavior safely preserves the draft and requires
confirmation. A later explicit recovery action could retain that draft and make
reselection easier without silently retargeting or sending it.
