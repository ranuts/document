# Assistant table and code-block craft

The user rejected the current table/code presentation and requested industry references.
This work continues the authorized whole-assistant polish; the single-return correction
remains part of the same delivery and must retain its verified behavior.

## Evidence and direction

| Assumption                                                                                          | Evidence                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The renderer drops fence language and table column alignment                                        | `packages/chat-ui/src/markdown.ts`, code/table branches                                                                                                            |
| Artifact text preview already uses the same safe renderer                                           | `lib/agent-plugin/ui/artifact-presentation.ts`                                                                                                                     |
| Chat and artifact table/code styles have separate owners                                            | `packages/chat-ui/src/styles.ts`, `styles/assistant-artifacts.css`                                                                                                 |
| ChatGPT exposes language and Copy on code blocks                                                    | [official help](https://help.openai.com/en/articles/20001246-working-with-writing-blocks-and-code-blocks-in-chatgpt)                                               |
| A quiet table can use hierarchy and alignment without a heavy header slab                           | [Geist Table](https://vercel.com/geist/table), actual public-page screenshot inspected                                                                             |
| Mature code blocks separate language/actions from syntax-highlighted content                        | [Geist Code Block](https://vercel.com/geist/code-block), actual public-page screenshot inspected; [AI Elements](https://elements.ai-sdk.dev/components/code-block) |
| Ran's existing Shiki helper is private; its full Markdown component also enables embedded renderers | `work/ran/packages/ranui/components/markdown/{highlight,render,index}.ts`                                                                                          |

The shared safe Markdown renderer remains the owner. Tables use quiet headers, intentional
column padding and restrained row separators; honor only explicit left/center/right Markdown
alignment and use tabular numerals. Wide tables scroll within an accessible, named region.
Do not invent sorting or spreadsheet controls for static answer tables.

Code blocks gain one compact language/Copy header, restrained frame, readable mono type and
preserved whitespace. Copy operates on the exact code payload and reports real success/failure.
Use token spans for highlighting, never model HTML. Unknown/oversized/unfinished code remains
readable plain code. Theme changes recolor without re-highlighting or replaying text.
No execution or preview control is added without an actual supported execution path.

## Scope lock

- May change: `packages/chat-ui/src/{markdown,streaming-markdown,styles,chat-view,types,index}.ts`,
  small co-located Markdown presentation/highlighting/style helpers, `packages/chat-ui/package.json`,
  `pnpm-lock.yaml`, artifact presentation/labels and surrounding CSS, applicable shared locale
  messages, affected tests and concise design/usage docs.
- Leave model defaults, transport, storage schema, inference, document mutation, vendor code,
  immutable evaluation archives and the verified navigation logic untouched.
- Preserve safe links, literal HTML/images, streaming's 8000-character parser bound, raw source
  used for Copy/Save/Apply, source selection, reader attachment, Stop acknowledgement and disposal.
- Highlighting uses an explicit matching `shiki@4.4.3` dependency and fine-grained lazy core,
  JavaScript regex engine, bounded language imports and GitHub light/dark themes. This uses the
  same engine/version already in ran without deep-importing private build chunks. Highlight at
  most 8000 UTF-16 characters in a completed block. The fixed language/alias import map covers
  JavaScript, TypeScript, JSX, TSX, Python, JSON, HTML, CSS, Bash, SQL, YAML and Markdown;
  unknown fences remain plain code, with no language-driven import path. Adding an
  upstream public API would require a new release/large downstream binary patch for this focused
  correction; the direct declared dependency is the smaller supported integration.
- Own copy/highlight async work and timer cleanup in a renderer presentation lifecycle shared
  by Chat and Artifacts. Guard removed/replaced content and pending clipboard results. Preserve
  active text selection and horizontal scroll. Keep syntax font metrics stable.

## Acceptance

Verify language and exact clipboard payload, actual success/failure feedback, repeated copy,
live localization/disposal, explicit table alignment, literal adversarial HTML/code, unknown
languages, oversized/incomplete/streamed blocks, dark/light color and local horizontal scroll.
Exercise both real Chat and Artifact previews with short/wide tables, multiline/long-line code,
English/Portuguese and 320/360px touch. Inspect full panes plus recorded copy/scroll behavior
before updating the existing PR. Existing parser/security/navigation assertions are retained.
