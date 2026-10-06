# IM keyboard and scrolling refinement

The IM remains a compact document workspace: settings stay collapsed, instructions and responses occupy the conversation, and document changes use native Undo and Save. No preview card or confirmation flow was added.

In the production CPU baseline, Shift+Tab from the composer focused the jump-to-latest button with opacity 0 before and after a real “Hello.” reply. CSS had hidden its appearance and mouse interaction, but retained keyboard focus and accessibility exposure. The baseline field named `empty` denotes the phase before that reply; it did not independently assert empty restored history.

The button now uses the native hidden attribute with an explicit display:none rule. When it disappears while focused, focus moves to the programmatically focusable message container with preventScroll. It stays hidden for the welcome state even if welcome content overflows a short viewport. Message append updates the control when the reader is not following the bottom, while retaining the existing policy of not moving readers on new content.

Three regression tests were observed failing before the initial fix. A stricter empty-state overflow regression failed after the first fix and passed after the welcome-state guard. All 12 ChatView tests pass. Independent reviews found no Critical or Important issue. Final production build, root lint, and the full 115-file / 4079-test suite passed. Converter PromiseRejectionHandledWarning messages predate this change.

The final production probe used real GPU Qwen 1.7B streaming. While the reader stayed at scrollTop 0, reply length grew from 1011 to 1057 without moving the reader. Keyboard activation invoked native smooth scrolling; the button hid at the bottom and focus remained in the message container while generation was still running. Stop restored the input. Shift+Tab skipped the hidden control both before generation and after Stop. A new conversation in the short viewport also hid it and retained a visible keyboard target.

At 1280×900 and 390×844 the panel was white; at 390×420 with dark color preference it was rgb(26,26,26). The panel had no horizontal overflow and the send/stop control remained reachable. The fixed runtime report contains no page errors, no final visible error messages, and no preview cards. These are desktop Chromium viewport simulations, not physical mobile keyboard or screen-reader tests. The intermediate report preserves the failed empty-state-overflow check rather than counting it as a pass.

Exact executed sources and SHA-256 hashes accompany each report. Browser screenshots were visually inspected; the current document and IM retain the established restrained typography, neutral surfaces, and fixed composer.
