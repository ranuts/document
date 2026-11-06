# ran-tokens vs Graphite — sync check (2026-11-06)

## Question

Does `public/ran-tokens.css` lag the Graphite neutrals in
`ran/packages/ranui/theme/tokens.less` (`#111113` light ink, `#0a0a0b` dark bg)?

## Answer

**Yes vs ran source; no vs the project's installed build input.**

| Layer                                            | `--ran-gray-1000` (light) | Dark `--ran-background-100` | Notes                                                           |
| ------------------------------------------------ | ------------------------- | --------------------------- | --------------------------------------------------------------- |
| `tokens.less` (ran main)                         | `#111113`                 | `#0a0a0b`                   | Graphite (#473), 2026-10-26                                     |
| Local `ranui/dist/ranui.css` (uncommitted build) | Graphite present          | Graphite present            | Built from current source                                       |
| npm `ranui@0.5.2` / `@0.5.3`                     | `#171717`                 | `#000000`                   | 0.5.3 published **before** Graphite landed                      |
| `document` `public/ran-tokens.css`               | `#171717`                 | `#000000`                   | Body identical to installed `node_modules/ranui/dist/ranui.css` |

`bin/build.sh` already vendors from `node_modules/ranui/dist/ranui.css`. Re-running
the build **cannot** pick up Graphite until a published ranui release ships that
dist (next version after 0.5.3). Hand-editing `public/ran-tokens.css` is forbidden
by the file header and by design-token contracts.

## Unblock

1. In **ran**: rebuild + publish ranui with Graphite tokens (do not rewrite tokens
   inside document).
2. In **document**: bump `ranui` / `ranuts` to that version, run `pnpm build`
   (or at least the token sync section of `bin/build.sh`), commit the refreshed
   `public/ran-tokens.css`.

## Chrome note

Homepage / landing chrome already read `--ran-*` (`public/home.css`,
`public/landing.css`). Once Graphite lands via the bump above, tool surfaces pick
it up without a magazine-layout pass.
