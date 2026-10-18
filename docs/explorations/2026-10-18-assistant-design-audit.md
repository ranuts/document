# Assistant surface audit against the ranui design standard

Date: 2026-10-18
Scope: the whole first-party surface, weighted to the AI assistant (`styles/assistant.css`,
`packages/chat-ui`, `lib/agent-plugin/ui`).
Standard: `ran`'s `packages/ranui/docs/DESIGN.md` (§1–§12), `INTERACTION.md`, and this
repository's own `docs/design-system.md`.

The assistant's behaviour layer already holds up: `ChatView` follows the transcript only
while the reader is at the bottom, suspends on real reader intent, restores position after
a re-render, and keeps a jump-to-latest control that gives focus back. Every icon-only
control carries an accessible name, the enable switch is a real `role="switch"` with a
synced `aria-checked`, and failure copy answers what happened, whether anything changed
and what to do next. The defects were in the layer that is hardest to review by reading —
the stylesheet — and in the checker that was supposed to be watching it.

## The checker was not watching

`semanticLiterals()` in `bin/design-tokens.mjs` is what makes "no raw semantic metrics"
true rather than aspirational. Its property pattern was `padding(?:-[\w]+)?`: the class
accepts letters, digits and `_`, but **not a hyphen**. `padding-inline-start` therefore
matched as `padding-inline`, the `:` that the pattern required next never arrived, and the
declaration was skipped entirely. Logical properties are the form this codebase actually
writes, so the rule was blind wherever it mattered:

| File                   | Declaration                  |
| ---------------------- | ---------------------------- |
| `styles/assistant.css` | `padding-inline-start: 12px` |
| `styles/assistant.css` | `margin-inline-end: 8px`     |
| `public/landing.css`   | `padding-inline-start: 22px` |

The character class now accepts hyphens (`[\w-]`), and the unit contract asserts a logical
property directly so the gap cannot reopen. Three values were corrected: `12px` → `--ran-space-3`,
`8px` → `--ran-space-2`, `22px` → `--ran-space-6`.

DESIGN §5 ("Never animate a theme switch") had no mechanical owner at all. `paletteTransitions()`
now reads every `transition` declaration and judges each comma-separated part by its first
token: a timing value in first position means the property was omitted, i.e. `all`; a named
palette property (`background`, `color`, `border-*-color`, `box-shadow`, `fill`, `stroke`)
is banned. A lone `var(--…-transition)` is the documented opt-in hook and is skipped.

It found twelve declarations in five files. Four were bare durations — `transition: 0.15s ease`,
which is `all` — on the home and landing navigation links. Eight named palette properties only.
All twelve are gone; every hover and focus now snaps, which is also what §5 asks for on
frequent feedback.

## The assistant panel

| #   | Finding                                                                                                                                                                                                                         | Owner                     | Standard |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------- |
| 1   | The current conversation was filled with `--ran-color-bg-hover` while `:hover` used `--ran-color-bg-active` — the persistent state shared the transient one's fill, and hover was the _stronger_ of the two.                    | conversation list         | §11      |
| 2   | `.agent-task-action` transitioned `background-color` and `border-color` at a literal `120ms`, so the welcome task rows faded on a theme flip while the page snapped.                                                            | welcome empty state       | §5       |
| 3   | Header icon targets were 30px, 28px (quote) and 32px (clear) in one row; at ≤480px the buttons became `34×40` while clear and quote stayed 44.                                                                                  | panel header              | §11      |
| 4   | `calc(var(--ran-radius-sm) / 2)` — a 3px corner that exists nowhere else in the product.                                                                                                                                        | user message bubble       | §4       |
| 5   | Four colour fallbacks were light-only literals (`#ddd`, `#2563eb`, `#0070f3` ×2), so the declaration would keep a light value in dark mode.                                                                                     | GGUF picker, focus rings  | §1       |
| 6   | `margin: 0.5rem 0` and `padding: 0 0.15em` bypassed the scale; the citation inset is genuinely optical, so it is now a named local token rather than an anonymous em.                                                           | source preview, citations | §2       |
| 7   | Eight selectors were declared twice. The later block silently won, so the earlier `font-size: 20px`, the flex row on the empty-state actions and the `flex-basis` on the welcome hint were dead code that still read as intent. | throughout                | §11      |
| 8   | `.agent-panel-settings-toggle` set `margin-left/right` and then `margin: 0` in the same block.                                                                                                                                  | panel header              | §11      |
| 9   | `.agent-panel-close` declared `border`, `background`, `cursor` and `color: text-disabled` — all outranked by the shared header rule. The colour was the dangerous one: it claimed a disabled close button.                      | panel header              | §1       |
| 10  | Nineteen focus rings used three different colours: `--ran-color-primary` ×12, `--ran-color-link` ×5, `--ran-blue-700` ×2.                                                                                                       | throughout                | §7       |
| 11  | A 20px inset was fabricated as `calc(space-4 + space-1)` in three rules that must agree — the status lines align to the composer's text, not its edge.                                                                          | composer status lanes     | §11      |

All eleven are fixed. Where a fix changed a value rather than a name, it moved onto the
scale: 20px → `--ran-space-6`, 3px → `--ran-radius-sm`, 40px → `--ran-size-7`.

## Evidence

Static, in CI:

- `test/unit/site-token-consistency.test.ts` — 12 passing. Two new assertions cover the
  logical-property form and the palette-transition ban; both are also run over every
  authored stylesheet and every freshly generated page.
- `verify:design` (ranui's nine mechanical rules) against `styles/` and `public/`:
  `dark-unsafe-fallback` and `bare-colour` are now clean. `spacing-scale` and `sizing-scale`
  still report the `clamp()` gaps in `home.css`/`landing.css`/`history.css` and the pill
  height `calc(22px + space-2 * 2)` — all explicitly allowed by this repository's own
  contract (fluid composition, hairline/optical geometry) and unchanged.

Rendered, in Chromium at 1280×900 against a production build:

| Measured                           | Before                                   | After                                  |
| ---------------------------------- | ---------------------------------------- | -------------------------------------- |
| Header icon boxes                  | 30, 28, 32, 32, 32 (and 34×40 at ≤480px) | 32×32 ×5, radius 6px                   |
| Current conversation fill          | `--ran-color-bg-hover` `#ebebeb`         | `--ran-color-bg-active` `#e6e6e6`      |
| Hover fill                         | `--ran-color-bg-active` `#e6e6e6`        | `--ran-color-bg-hover` `#ebebeb`       |
| `.cui-send` / `.cui-stop`          | `background-color, color` 0.15s          | `all` 0s (no transition)               |
| `.agent-task-action`               | `background-color, border-color` 120ms   | `none`                                 |
| Focus ring on a header button      | `rgb(0,110,254)` (blue-700) for some     | `rgb(23,23,23)` 2px solid, all         |
| Theme flip (`data-ran-theme=dark`) | —                                        | `#171717` → `#ededed`, panel `#1a1a1a` |

The selection fix is verified in the built cascade, not only in source: the hovered rule
declares `--ran-color-bg-hover` and the `[aria-current]` rule declares `--ran-color-bg-active`,
with the persistent rule second at equal specificity, so hovering the current row keeps the
stronger fill.

## Reviewed and deliberately unchanged

- `clamp()` gaps in the page families, and the `min-height: calc(22px + …)` nav pill: both
  are documented exceptions in `docs/design-system.md`, not spacing decisions.
- 96px language lane, 160/240/280px scroll caps: intrinsic dimensions, not the spacing scale.
- No `aria-live` region around the transcript. `aria-busy` already marks the phase, and
  announcing streamed tokens would break INTERACTION §3's "do not announce every streamed
  character". Adding one needs a design decision about what a polite announcement says when
  the answer is still being written.
