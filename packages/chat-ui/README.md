# @ranuts/chat-ui

Framework-free chat / IM UI component (built with the ranui builder): a scrolling message list
with streaming support and an auto-growing input box with Send / Stop controls. Bring your own backend — it only renders and emits events.

## Usage

```ts
import { ChatView } from '@ranuts/chat-ui';

const chat = new ChatView({
  onSend: (text) => {
    chat.append({ role: 'user', text });
    chat.setRunning(true);
    // ...call your backend, stream the reply:
    chat.appendDelta('Hello');
    chat.appendDelta(' world');
    chat.endStream();
    chat.setRunning(false);
  },
  onStop: () => {
    /* abort the in-flight request */
  },
  labels: {
    send: 'Send',
    stop: 'Stop',
    placeholder: 'Type a message…',
    empty: 'Start a conversation',
    role: (r) => (r === 'agent' ? 'AI' : ''),
  },
});

container.appendChild(chat.el);
```

Styles are injected automatically on first construction; no CSS import needed.
Override the look via the `--cui-*` custom properties on `.cui-root`.

## API

- `append({ role, text })` — add a finished message (`user` / `agent` / `tool` / `status` / `error`).
- `appendDelta(text)` — stream text into a live agent bubble (auto-created).
- `endStream()` — finalise the streaming bubble.
- `setRunning(bool)` — update run controls while keeping the next draft editable; queue acceptance is opt-in.
- `setActivity(phase)` — display the host's actual `routing`, `reading`, `planning`,
  `responding` or `reviewing` phase. Classification must be reported only when it runs.
- `clear()` — remove messages and waiting feedback; it does not stop the host's run.
- `getInput()` / `setInput(text)` / `focus()` — input helpers.
- `setLabels(labels)` — update labels live (e.g. language change).
- `actionsEl` — host-populated slot above the input (compose toolbar); collapses when empty.

Waiting feedback appears immediately, with a locally measured clock formatted
by `labels.elapsed(seconds)` and a classification label from `labels.routing`.
Clock ticks are visual only and stay outside live regions. First response text,
Stop/completion and disposal end the clock; human review shows a resting status.
Elapsed seconds describe waiting, without estimating model progress or speed.

Hosts may mark validated document content with `documentArtifact: true` in
`append(...)` or the metadata argument to `appendDelta(...)`. It receives a
document-draft header; ordinary chat prose and tool receipts remain distinct.
Localize the header through `labels.documentDraft` and `labels.incomplete`.
Interrupted output remains copyable and is labeled incomplete, with no write
action. Header text is never included in copied or applied content.

An explicit `onApplyMessage` callback owns writing. Use
`requireDocumentArtifact: true` to restrict this callback to host-marked content;
streaming, interrupted and `copyOnly` results cannot offer it. Only explicit
`endStream()` makes a completed streamed result available to that host action.

Intentional cancellation can use `status`: plain muted text with the same draft recovery as an error, without an error border. Status text is never returned by `getLastAnswer()` or offered as document content.

Hosts may provide `canSend(text)` to keep drafts editable while a dependency is unavailable. Call `refreshSendAvailability()` when readiness changes. This blocks both Send and Enter without clearing or queuing the draft; Stop remains available during a running turn.

The document product uses a default-off assistant switch. Opening the panel never downloads a model or connects a service. Runtime configuration is reached through the usage settings; generated selection edits require explicit review and confirmation. Browser-agent tools are documented separately in the developer reference.

`requestStop()` is the shared Stop entry point for buttons and host actions. On
its first call during a run it immediately shows `labels.stopping` (default
“Stopping…”), freezes the partial source as incomplete/copy-only, disables
repeat Stop, and calls `onStop` synchronously. It preserves the editable next
draft and focus. Legacy hosts preserve the draft until settlement; queue-enabled
hosts may accept another pending request while cancellation settles.
`appendDelta()` and `endStream()` ignore late output during this state. The host
must keep the run active until its cancellation settles, then call
`setRunning(false)`. Markdown formatting of the captured interrupted row runs
after the acknowledgement has a chance to paint, with disposal/row ownership
guards. Stop does not claim that the backend has already finished.

## Optional host queue

Provide `onQueue(text)` to accept Enter or Send during a running turn. It receives
original nonempty text after the same `canSend`, `beforeSend`, IME and asynchronous
revision guards as `onSend`. The composer clears only an accepted submission and
keeps keyboard focus. `labels.queue` names this control while running.

With this hook, Send remains independent from the compact Stop control. Without
it, the existing Send-as-Stop behavior is preserved. Both variants use the shared
`requestStop()` acknowledgement and interrupted-source ownership guards. Stop
continues to use `.cui-send-stop` for existing host selectors; `.cui-send` remains
the Send/Queue control in an opted-in host.

`chat.pendingEl` is a host-populated footer slot immediately above the composer,
outside its focus boundary and separate from message history and `actionsEl`. The component knows nothing about editors, providers,
request ordering, cancellation settlement or persistence. Hosts must keep one
execution owner until the actual submit settles, retain unexecuted text on
preflight failure, and advance their queue only on explicit successful outcomes.

## Bounded history restoration

`chat.restoreHistory(messages, { pageSize: 40 })` opts into recent-window
presentation. It replaces the displayed conversation, initially renders at most
40 source messages and offers a keyboard-accessible control to prepend earlier
batches. `pageSize` may be smaller and is capped at 40. `appendMany` retains its
existing eager behavior for other hosts.

Prepending keeps existing rows, live streams, review cards, the next draft and
reader position. Recovery uses each message's original preceding request, while
later errors still refer to the latest request. Last-answer/document getters use
the complete restored source even when its answer is outside the visible window.

Restored messages longer than 8000 characters show a bounded preview and an
explicit full-message expansion. Copy/apply always receive the complete original
source and metadata. Ordinary append and streaming remain unchanged. Localize
`labels.loadEarlier` and `labels.expandMessage`; English defaults are provided.
Clear, replacement and disposal invalidate old controls. This changes only
presentation; hosts continue to own full history, storage and model context.
