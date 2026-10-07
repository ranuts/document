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

| Method                                      | Purpose                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `append({ role, text })`                    | Add a finished message. `role`: `'user' \| 'agent' \| 'tool' \| 'status' \| 'error'`. |
| `appendDelta(text)`                         | Stream into a live agent bubble (auto-created on first delta).                        |
| `endStream()`                               | Finalise the streaming bubble (drops the caret).                                      |
| `setRunning(bool)`                          | Toggle Send⇄Stop and lock the input.                                                  |
| `clear()`                                   | Remove all messages, restore empty state.                                             |
| `getInput()` / `setInput(text)` / `focus()` | Input helpers (e.g. prepend a quote).                                                 |
| `setLabels(labels)`                         | Re-apply labels live (e.g. language change).                                          |

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
- Restyle via CSS custom properties on `.cui-root` (`--cui-accent`, `--cui-user-bg`, …) — don't depend on internal `cui-*` class names.
- DOM is built with the ranui `builder` (View/Div/Span/ButtonBuilder) and the scroll handler is throttled via ranuts; the package depends on `ranui` + `ranuts`.

Intentional cancellation can use `status`: plain muted text with the same draft recovery as an error, without an error border. Status text is never returned by `getLastAnswer()` or offered as document content.

Hosts may provide `canSend(text)` to keep drafts editable while a dependency is unavailable. Call `refreshSendAvailability()` when readiness changes. This blocks both Send and Enter without clearing or queuing the draft; Stop remains available during a running turn.
