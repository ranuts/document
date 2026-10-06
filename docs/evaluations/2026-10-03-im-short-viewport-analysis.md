# IM short viewport layout

[Baseline](2026-10-03-im-narrow-layout.json) reproduces an unreachable send button after entering twelve long lines. At 390×420 its bottom was 472px with settings closed and 606px with settings open; at 320×320 it was 472/559px. The textarea's growth and fixed composer spacing exceeded the available chat height. Screenshots were inspected in isolated Chromium with the actual production IM and cached 1.7B model.

The short-height CSS now reserves composer space, reduces header/settings/footer spacing, limits settings to a scrollable region and keeps long input in a 40px scrolling textarea. Bottom safe-area spacing is preserved. No controls or confirmation steps were added.

[Final production evidence](2026-10-03-im-narrow-layout-fixed.json) covers four viewports (1440×960, 390×844, 390×420, 320×320) with settings both closed and open. Every textarea/send button fits using a 1px subpixel tolerance. Desktop and taller narrow-screen geometry is unchanged. Actual generation at 390×420 with settings open exposed an additional status-space issue during development; the final run verifies Stop by center hit-test, actual click and input recovery. Its bottom is 420.234px, a fractional 0.234px edge overflow, rather than the original unreachable button. There are no captured page errors.

Production build and lint passed; independent review found no must-fix issue and identified the safe-area requirement incorporated into the final CSS. This CSS-only change was verified in the browser rather than through a unit test that checks stylesheet text. The existing full suite last passed with 3959 cases before this layout change.

These are desktop viewport simulations. They do not establish physical iOS/Android keyboard behavior: some browsers shrink only the visual viewport without triggering the height media query. Physical keyboard/safe-area tests, running at 320×320 and long-conversation/history accessibility remain open.

## Minimum-window runtime and long-history follow-up

[Actual 320×320 generation/Stop](2026-10-03-im-short-running-320.json) now verifies the smallest simulated window with settings open: Stop's center hit-test succeeds, clicking it cancels the real local 1.7B generation and the input becomes enabled. Its fractional bottom edge is 320.234px, within the stated 1px geometry tolerance. No page errors were captured.

[Synthetic long history](2026-10-03-im-long-history-layout.json) restores twelve valid IndexedDB conversations through the production Restore control. The active conversation contains sixty synthetic user/assistant messages with long unbroken strings and long prose; these are fixtures, not model-generated dialogue or a model context-window benchmark. The isolated profile's previous database state was restored afterward.

At 390×844 and 320×320, the production message count is sixty and the conversation selector has twelve entries. Neither the message region nor the panel overflows horizontally. Long session titles fit the selector. Send remains in the viewport. Scrolling to the top exposes the existing jump button; clicking it reaches the bottom after the smooth scroll completes (0/1px remaining). Screenshots were inspected. At 320×320, only 53px of message area remains visible, a practical limitation of this very short window rather than proof of comfortable long-form reading.

This closes the previously untested desktop minimum-window runtime and basic long-history rendering/scroll cases. Physical keyboard behavior, accessibility tooling/assistive technology, history export/delete flows with long data and model handling of long conversation context remain separate checks. No product source changed in this follow-up.
