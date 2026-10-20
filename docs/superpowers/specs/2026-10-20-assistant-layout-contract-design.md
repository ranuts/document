# Assistant layout and acceptance contract

## Intent and evidence

The owner requested a cross-repository correction: strengthen ran's layout guidance and
acceptance, then apply it to all analogous document assistant surfaces with multiple commits.
The existing workspace specification requires a shared 16px inset. Browser measurements at
main `7bf478b7` found a 16px content/frame rail, a 24px header text rail, and a 56px subpage
heading rail. The title's 77px text occupied a 229px hover target. The existing sidebar test
compares button rectangles, so it cannot detect the extra 8px text inset.

## Scope lock

- ran owns general composition guidance and an executable browser acceptance example.
- document owns `styles/assistant.css`, focused assistant view composition if needed,
  `docs/design-system.md`, assistant browser tests and their geometry utilities, and this
  implementation record. Inspect chat/onboarding, Models, Conversations, Sources, Artifacts,
  artifact import/editor, populated lists, disclosures, statuses and empty states.
- Preserve navigation/focus, drafts, request ownership, local-model opt-in, document writes,
  save/recovery behavior, persistence schemas, vendor assets and library foundation values.
- No library release or dependency bump is needed for a host composition correction.
- Each repository gets its own cross-linked PR. Preserve multiple English conventional commits.

## Layout decisions

The host has one content rail, 16px from the panel's inside edge. Header title text,
unframed copy, section labels and field/list outer frames use that rail. Framed fields
retain their own text inset. Centered empty states remain centered within the shared frame.

The title's hover target hugs its text with an 8px internal inset. Its leading hit-area
extension belongs to the header gutter; a separate flexible space keeps the action group at
the trailing edge. Long titles shrink and ellipsize without moving or covering the actions.

Subpage back controls have an explicit navigation column. Their 16px SVG viewport shares
the content rail; a centered pointer target extends into the leading gutter. The heading
occupies a separate, repeated title rail after this column and its 8px gap. The target is
32px for fine pointers and 44px for coarse pointers. This is a named navigation hierarchy,
not a claim that the heading and body text have equal coordinates. The full target remains
inside the panel, including coarse input. The same composition applies to every subpage
and nested artifact state, with no per-page horizontal corrections.

Vertical relationships use 8px internal, 16px group and 24px section spacing. Empty status
paragraphs do not reserve anonymous margins. Artifact explanatory copy starts at the same
post-header group boundary as other subpage content; nested forms do not accumulate inset.

## Acceptance

- Measure after fonts and reachable async views settle. Compare visible text with DOM Range,
  frames with bounding rectangles, and ranui field parts inside their real shadow roots.
- Header text, content frames and navigation SVG viewports share the declared content rail;
  repeated heading rails and first-content group gaps agree across subpages.
- Title hover width hugs the rendered text plus declared padding; header actions remain
  reachable. Focus outlines remain visible; back/close/title keyboard behavior is preserved.
- Exercise 320px, 360px and 432px panels, both themes, English and Portuguese, fine/coarse
  input, and a long heading. Inspect actual screenshots at representative widths.
- Exercise artifact list, import, editor and return paths; source attach/status and history
  populated/empty states. Preserve user text while navigating.
- A real text-only 8px inset mutation must fail while its outer box stays aligned. Additional
  reverse checks must detect a flex-expanded title target and a displaced subpage content rail.
- Run focused browser suites, full unit tests, type/lint, token/format and production build.

## Simplest alternative

Use existing native controls, ranui parts and shared CSS composition. A new framework,
component API or site-wide token scale adds no necessary behavior. A screenshot-only patch
cannot enforce the same relationships in hidden, nested or translated states.
