# @ranuts/chat-ui — AI usage guide

Framework-free chat/IM UI built with the ranui builder. Renders messages + an input box and
emits events; it has **no backend, no LLM, no editor knowledge**. Wire it to
whatever you want.

## When to use

Any "chat panel" surface: a message list with role bubbles, streaming assistant
replies, and a Send/Stop input. Don't reach for it if you just need a textarea.

## Import

```ts
import { ChatView } from '@ranuts/chat-ui';
import type { ChatMessage, ChatRole, ChatViewLabels, ChatViewOptions } from '@ranuts/chat-ui';
```

Styles are injected automatically on first `new ChatView(...)` — **do not import any CSS**.

## Construct

```ts
const chat = new ChatView({
  onSend: (text) => {
    /* user submitted original `text` (non-whitespace) */
  },
  onStop: () => {
    /* user clicked Send while running → treat as abort */
  },
  labels: {
    send: 'Send',
    stop: 'Stop',
    placeholder: 'Type…',
    empty: 'Start chatting',
    role: (r) => (r === 'agent' ? 'AI' : ''),
  },
});
container.appendChild(chat.el); // mount the root element
```

## Methods

| Method                                                                         | Purpose                                                                                              |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `append({ role, text })`                                                       | Add a finished message. `role`: `'user' \| 'agent' \| 'tool' \| 'status' \| 'error'`.                |
| `restoreHistory(messages, { pageSize?: number })`                              | Opt into a recent window (default/max 40) and load earlier messages without replacing existing rows. |
| `appendMany(messages)`                                                         | Add finished messages in order with one final layout update, for restoring history.                  |
| `appendDelta(text)`                                                            | Stream into a live agent bubble (auto-created on first delta).                                       |
| `endStream()`                                                                  | Finalise the streaming bubble (drops the caret).                                                     |
| `observePresentation(callback?)`                                               | Arm one request-owned visible DOM text observation; omit the callback to cancel.                     |
| `setRunning(bool)`                                                             | Update run controls; keep the next draft editable, with optional host queuing.                       |
| `setActivity('routing' / 'reading' / 'planning' / 'responding' / 'reviewing')` | Announce the host's actual phase through a polite status; review is a resting state.                 |
| `clear()`                                                                      | Remove all messages, restore empty state.                                                            |
| `getInput()` / `setInput(text)` / `focus()`                                    | Input helpers (e.g. prepend a quote).                                                                |
| `setLabels(labels)`                                                            | Re-apply labels live (e.g. language change).                                                         |
| `dispose()`                                                                    | Release resize observers and copy-feedback timers when unmounting.                                   |

`chat.actionsEl` is a host-populated slot directly above the input (an IM-style
compose toolbar) — append your own controls; it collapses when empty.

## Canonical streaming flow

```ts
onSend: async (text) => {
  chat.append({ role: 'user', text });
  chat.setRunning(true);
  try {
    for await (const delta of backendStream(text)) chat.appendDelta(delta);
    chat.endStream();
  } catch (e) {
    chat.append({ role: 'error', text: String(e) });
  } finally {
    chat.setRunning(false);
  }
};
```

## Gotchas

- `onSend` ignores whitespace-only input and preserves the original payload; the component clears the input on submission.
- Streaming: call `appendDelta` repeatedly, then exactly one `endStream`. Don't `append` an agent message during a stream.
- The send button is an **icon** (up-arrow ⇄ stop square); `labels.send`/`labels.stop` become its `title`/`aria-label`. It auto-disables when the input is empty (and idle).
- Modern look: assistant messages are bubble-less/full-width, the user gets an accent bubble, tool/error render as subtle chips; a jump-to-latest button appears when scrolled up and new content only auto-scrolls when already near the bottom.
- Width changes reflow the draft. Layout changes keep following the latest reply only while the reader is attached to the end; browsing history preserves its position.
- Message arrivals consume the current following state. They must not recompute it from post-reflow geometry: scroll handling owns reader attachment, while jumping to the end and clearing reset it.
- Use `appendMany` for history restoration. It keeps the same message rendering and tool grouping as `append`, while deferring intermediate scroll measurements. Completed and interrupted streams publish their original source when finalized; streaming actions stay hidden.
- Copy feedback uses fixed-size icons and a separate polite announcement. Clipboard failure leaves the action available to retry; feedback never replaces running activity.
- Actual waiting phases appear immediately. `labels.routing` names request
  classification; use it only while the host is classifying, never for a task
  that already has known intent. `labels.elapsed(seconds)` formats a visual
  waiting clock measured with monotonic local time. Its ticks stay outside live
  regions. It ends on the first response text, Stop/completion or disposal;
  human review shows no clock or loading cue. The clock is not estimated
  progress, model reasoning or a promise of faster computation.
- `clear()` clears rendered waiting feedback and its timer, without cancelling
  the host operation or removing Stop. Feedback resumes only after a new
  `setRunning(false)` → `setRunning(true)` transition.
- Explicit `documentArtifact: true` identifies a document-draft surface. Ordinary
  prose and tool receipts never acquire this identity by mentioning a document.
  `labels.documentDraft` and `labels.incomplete` localize the result header;
  updating labels also updates existing results. Interrupted streams keep their
  source available for copying and show the incomplete identity, with no write
  action. Set `requireDocumentArtifact: true` when a host must restrict its
  explicit `onApplyMessage` callback to marked document content. Result labels
  never become part of the original source used for copy or apply.
- Restyle via CSS custom properties on `.cui-root` (`--cui-accent`, `--cui-user-bg`, …) — don't depend on internal `cui-*` class names.
- DOM is built with the ranui `builder` (View/Div/Span/ButtonBuilder) and the scroll handler is throttled via ranuts; the package depends on `ranui` + `ranuts`.

Intentional cancellation can use `status`: plain muted text with the same draft recovery as an error, without an error border. Status text is never returned by `getLastAnswer()` or offered as document content.

Hosts may provide `canSend(text)` to keep drafts editable while a dependency is unavailable. Call `refreshSendAvailability()` when readiness changes. This blocks both Send and Enter without clearing or queuing the draft; Stop remains available during a running turn.

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

Bounded restoration is opt-in. Convert host history to complete display messages
before calling `restoreHistory`; do not slice before conversion because adjacent
status/interruption metadata and request recovery can cross a window boundary.
Full restored source remains available to source getters and copy/apply. Only
restored previews are capped at 8000 characters, with explicit expansion.
Prepending is render-only: it must not interrupt a live bubble, mutate the latest
recovery request or recreate existing review/actions. It preserves the actual old
visible node's position rather than inferring it from total scroll height.
`loadEarlier`/`expandMessage` labels have shared English defaults. Clear, a new
restore and disposal invalidate old history controls. Empty welcome layout never
follows the bottom; real message arrivals retain ordinary following behavior.

## Optional streaming Markdown

`streamingMarkdown: true` opts into per-stream block reuse; false/default preserves
legacy hosts. `streaming-markdown.ts` owns only presentation state. It reparses a
conservative tail (two blocks plus a verified blank-line boundary), checks raw
source offsets including CRLF, and renders the existing safe Marked token tree.
Reference definitions at any nesting level need whole-document resolution;
conservative reference candidates disable prefix reuse. No global parser cache,
React, remend, extra dependency or general incomplete-syntax repair is used.
Copy each bounded working tail before lexing so retained token substrings do not
pin earlier full growing response snapshots. Keep formatted streaming whitespace
normal via the opt-in modifier; raw spans and legacy streams retain pre-wrap.

All automatic Markdown inputs in this mode are capped at 8000 characters,
including finished messages, tails, reference fallbacks and interrupted streams.
An oversized tail stays raw after stable formatted blocks; oversized reference
fallbacks stay wholly raw even at completion. Never schedule an uncapped parse in
a later frame/task. Frozen bare URLs may remain inert for oversized mixed/raw results; do not traverse
all frozen blocks at completion to activate them. Bounded completion retains full
ordinary semantics. Full raw source remains the copy/apply payload. Explicit
restored-message expansion remains user-owned and history defaults do not change.

`flushStream(false)` is Stop's raw-only path: do not lex or render tokens before
`onStop`. Formatting after acknowledgement retains the captured row/helper and
checks row/source/disposal ownership. Clearing and disposal cancel old callbacks.
Links parsed from unfinished/bare/reference URLs stay inert during streaming; completed
explicit permitted links can navigate. HTML/image tokens stay literal text.
Keep unchanged DOM nodes and text selections; add no token animation or debounce.
The input cap bounds lexer input, not elapsed time on every device. See the
[Streamdown memoization reference](https://streamdown.ai/docs/memoization) and
[termination reference](https://streamdown.ai/docs/termination) for the design
inspiration; this component deliberately preserves raw incomplete source.

`observePresentation(callback?)` owns a fresh stream or completed append. Each
call advances a distinct revision; a live stream retains its creation revision
through flush/completion. Replacement must not adopt old buffered content or a
late tail, including when the host rearms the same callback function.
