# ranui 0.5.2: the language menu no longer flashes open

## Symptom

On the first load of `/`, the localized landing pages, the content pages and
`/history`, the language menu briefly showed all seven languages in a column.
The header stretched from 38 px to about 300 px, then snapped back.

## Cause

The menu is an `<r-popover>` whose links are written straight into the HTML
(`bin/pages/chrome.mjs`, `index.html`). Until the element is defined, the
browser lays those links out in flow. On the static pages the definition comes
from a deferred IIFE, and on `/history` from the Vite bundle.

`home.css` had `:not(:defined)` fallbacks for `r-button` and `r-theme-switch`,
but nothing hid `r-content`. Measured on production with the defining scripts
blocked, the menu host was 215–223 × 246–266 px on `/`, `/zh-CN/`, `/help` and
`/history`.

## Fix: in ranui, not here

The fix was made in the component library (chaxus/ran#444, released as ranui
0.5.2). `ranui.css` now ships `:not(:defined)` rules for every component whose
light-DOM children must stay hidden until the element upgrades: r-popover's
`r-content`, r-select's options, r-tabs, r-modal, r-reasoning, r-route,
r-markdown, r-math, r-mermaid and r-scratch.

This site vendors that sheet as `public/ran-tokens.css`. `bin/build.sh`
re-syncs it on every build, and every page links it in `<head>` before first
paint. Upgrading ranui is therefore the whole fix; no site CSS was added.

ranui also documents `<r-content hidden>` / `<r-option hidden>`, which lets the
browser hide that content even when the sheet is missing. It is not used here:
the sheet is already loaded before first paint on every page, so the attribute
would only add markup tied to the component's internals.

The `r-button` / `r-theme-switch` fallbacks in `home.css` stay. They reserve
the site's own button sizes before upgrade, which is a different problem from
content leaking out.

## Same upgrade

- **ranuts 0.5.2 and @alixex/ranview 0.2.2.** They ship with ranui as one
  release set, so the minimum-release-age exclusion pin moves to ranview 0.2.2.
- **DOMPurify 3.4.17.** ranui 0.5.2 depends on it, but the workspace override
  still forced 3.4.16, which has one critical and one high advisory. The
  override now names 3.4.17. This is dependency hygiene, not a user-facing
  change: only ranui's Markdown, Mermaid and Math chunks import DOMPurify, and
  this app loads none of them.
- **Lockfile resolution.** The existing lockfile kept ranview 0.2.1, published
  within the release-age window. With the exclusion moved to 0.2.2, pnpm
  refused it before resolving. The lockfile was resolved once with both
  versions allowed, then the temporary 0.2.1 entry was removed. A
  `--frozen-lockfile` install passes against the final policy.

## Test and reverse validation

`test/e2e/lang-menu-before-upgrade.spec.ts` runs on `/`, `/zh-CN/`, `/help`
and `/history`. It blocks `/ranui-iife/*.iife.js` and `/assets/*.js` so
`r-popover` is never defined. It then asserts that the list has no height and
the menu stays shorter than 48 px.

With `public/ran-tokens.css` swapped back to the 0.5.1 copy, all four cases
fail, with the menu at 245–266 px. With 0.5.2 they pass.
