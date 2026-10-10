# IM keyboard input in Chromium

Current ChatView already checks both composition state and legacy keyCode 229 before Enter submission. A real Chromium source harness verified native Shift+Enter inserts a newline without sending; native Enter submits and clears the input. After a synthetic compositionstart, native Enter did not submit; a synthetic compositionend followed by legacy 229 keydown also did not submit. A later normal Enter submitted once. Running state disabled the input and retained a draft; unlocking allowed that draft to send. Empty Enter produced no extra submission. Eight checkpoints passed with no page errors, and the browser/server closed.

Composition events were programmatically dispatched, not produced by a physical OS input method. In that synthetic state native Enter inserted a newline; this is not a claim about real candidate-selection behavior. The callback received the multiline body intact; controller trimming is a separate layer. Native editor integration, physical Chinese/Japanese/Korean candidate windows, mobile keyboard, accessibility and Safari/Firefox remain outside this harness. No product change was needed.

Run `python3 docs/evaluations/verify-chat-keyboard-browser.py` to independently check captured values and submission counts, bound to exact source and probe hashes.
