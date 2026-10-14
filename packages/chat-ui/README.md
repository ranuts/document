# @ranuts/chat-ui

Framework-free chat / IM UI component (built with the ranui builder): a scrolling message list
with streaming support and an auto-growing input box whose button doubles as
Send / Stop. Bring your own backend — it only renders and emits events.

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
- `setRunning(bool)` — toggle Send⇄Stop while keeping the next draft editable; never queue it.
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
