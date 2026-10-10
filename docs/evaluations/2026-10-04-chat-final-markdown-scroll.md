# Follow final Markdown layout without interrupting history reading

Streaming output was plain text; `endStream` rendered the final Markdown but did not realign the scroll position. Lists, paragraphs and tables can change height at this boundary. The view now checks whether the reader was near the bottom before rendering and scrolls to the final layout only in that case. Readers viewing earlier messages keep their position. No control, card or confirmation was added. Calls without a live bubble do not initiate scrolling.

The new two-case regression renders bold Markdown and verifies automatic final scrolling at the bottom and no scrolling when reading earlier messages. The bottom case failed before implementation; both passed afterward. These DOM tests provide controlled scroll geometry, so they verify the decision and render timing rather than real browser layout dimensions. A browser layout check remains needed for actual lists/tables, resizing and touch behavior.

Validation: product build passed; 116 test files / 4,244 tests passed. The full suite emitted an asynchronous rejection-handled warning. Source Oxlint excluding preserved untracked `.scratch/**` diagnostic artifacts, TypeScript, Docker configuration and diff checks passed. Existing history-reading and jump-control tests passed. This change does not improve model factual fidelity, which remains unresolved.

## Chromium layout verification

A separate source-and-style harness tested desktop width 1280 and narrow width 390, each with 20-row lists/tables and bottom/history-reading positions. All eight cases passed with real layout geometry. Rendering lists increased scroll height by 135 pixels; rendering tables increased it by 336 pixels. Bottom readers remained at the actual bottom afterward; earlier readers remained at scrollTop 120. No page errors occurred, and browser/server closed. The report and verifier bind the exact ChatView, style and Markdown source hashes. Run `python3 docs/evaluations/verify-chat-final-scroll-browser.py`.

This resolves the list/table layout gap for these Chromium cases. The narrow viewport is desktop-browser emulation, not a physical touchscreen. Native editor sidebar integration, dynamic resizing, zoom, assistive technology and touch scroll behavior remain outside this harness. No additional product change was necessary.
