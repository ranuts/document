# Sticky site header on home and content pages (2026-11-22)

## Why

The homepage and long content pages scroll past the first viewport. Without a
fixed top bar, brand / language / GitHub disappear — the controls people still
need after reading the hero.

## What changed

- `public/home.css` `#landing-hero .bar` and `public/landing.css` `header.bar`:
  `position: sticky; top: 0; z-index: 20; background: var(--ran-color-bg)`.
- Removed `overflow-x: hidden` from `#landing-hero`. Any non-visible overflow on
  that ancestor makes sticky stick to the section instead of the viewport, so
  the bar still scrolled away. Horizontal spill is already contained on the
  pieces that can overflow (docwin, wordmark ellipsis); body keeps
  `overflow-wrap: break-word` for long Latin runs.
- Content-page `.side` sticky `top` / `max-height` now clear the ~4.5rem sticky
  bar; the old `top: space-8` parked the rail behind the chrome once the bar stuck.
- `docs/design-system.md` records the sticky rule; `design-contract` and
  `site-design-consistency` pin both stylesheets and the scroll behavior.

## Reverse verification

Temporarily drop `position: sticky` from either bar rule: the new unit pin in
`design-contract` fails, and the E2E "top bar stays pinned…" case reports
`bar.top` leaving 0 after `scrollBy(900)`.
