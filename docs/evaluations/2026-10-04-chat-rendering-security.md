# IM content rendering regression coverage

Source inspected: `packages/chat-ui/src/markdown.ts` creates DOM elements from Marked tokens. HTML/image tokens become text nodes; code uses textContent; links allow only explicit HTTP(S) or mailto prefixes and use `_blank` with `noopener noreferrer`. User/tool messages use literal text nodes in `chat-view.ts`.

The added twelve adversarial fixtures exercise completed assistant, literal user/tool, and two-chunk streamed assistant messages. They include SVG handlers, iframe srcdoc, form/autofocus handlers, CSS remote URLs, mixed-case JavaScript URLs, data/VBScript/protocol-relative/relative links, remote images, nested list/blockquote markup and table HTML. Assertions inspect content DOM for executable/resource-loading elements, event-handler attributes and prohibited anchors. A separate positive fixture checks allowed web/mail links and remote-image text behavior.

Validation: all 27 chat-view tests pass, scoped oxlint with denied warnings, TypeScript check and diff whitespace check pass. No product changes. Initial twelve test failures were an overly broad assertion that included the application's trusted SVG copy icons; restricting element inspection to message bubbles and tool content corrected the test scope. No content injection defect was reproduced.

These are jsdom DOM-structure regression tests, not browser execution/network monitoring, an exhaustive XSS proof, a CSP audit or complete privacy certification. Two-chunk streaming samples do not cover every possible split. Further deployed/browser sink and resource-policy verification remains necessary.
