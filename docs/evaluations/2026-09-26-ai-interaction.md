# AI panel and IM interaction verification

Date: 2026-09-26. Target: local Vite editor with `?new=docx&agent=1`.
Tools: Chrome DevTools connector and opencli 1.8.3 (connected Chrome extension).

## Browser results

| Check                               | Result                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Submit before loading a local model | Draft retained; settings and load hint shown                             |
| Close and reopen panel (opencli)    | Draft retained; panel docking updated                                    |
| Model dropdown                      | Qwen3.5 0.8B selected through the dropdown item; no automatic model load |
| Enter / Shift+Enter                 | Send / newline behaved correctly                                         |
| Streaming and stop                  | Deltas displayed; stop restored input and send control                   |
| Long conversation                   | Scroll-to-bottom control appeared and reached the bottom                 |
| HTML-like message content           | Rendered as text; no injected image element                              |
| Desktop dark / mobile light         | Chat theme matched host design tokens after the fix                      |
| Mobile 390 × 844                    | No horizontal overflow observed                                          |
| Editor readiness                    | Review control enabled after document readiness                          |

IM streaming, stop, and long-conversation checks used the real ChatView component
with temporary, controlled browser-side data. They did not call an AI model.
The page was reloaded afterward to remove the temporary fixture. Screenshots were
inspected inline; no screenshot files are attached to this report.

## Issues fixed

- ChatView used its default white background in dark mode. The host now maps
  chat colors, tool messages, errors, and disabled controls to ranui tokens.
- The review control stayed disabled when the panel mounted before the editor.
  It now synchronizes on document readiness, with a regression test covering
  this initialization order.

## Automated validation and limits

Type checking, 63 test files / 3485 tests, and production build passed.
Existing test warnings about handled promise rejections and build warnings about
browser-externalized SDK modules and large chunks remain.

WebGPU adapter availability was confirmed, but no model weights were downloaded.
Real inference, model download/retry progress, GPU memory pressure, multilingual
quality, document preview/apply, and a full accessibility audit remain separate
validation work. This report does not establish production readiness for AI.
