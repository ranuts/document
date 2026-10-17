# Site design token consistency

## Approved scope

The user approved fixing all six findings from the site review, adding regression checks and delivering one follow-up PR. PR #277 is merged; start from its equivalent latest main. No additional approval is needed for implementation choices within this scope.

1. Preserve a visible, accessible home destination at narrow widths on the homepage, generated content pages, history, 404 and embed demo. Use compact text branding; do not reuse the PWA tile as header identity.
2. Update confirmation dialogs to ranui's supported `heading` API and verify the real rendered heading, cancellation and destructive confirmation.
3. Replace all removed 404 aliases with actual foundation tokens, restoring the diagram and both themes.
4. Complete interaction states: disabled queue controls must not gain enabled hover feedback; destructive confirmation states retain their semantic contrast and keyboard focus; keyboard and pointer history deletion affordances agree.
5. Remove undefined token references even where a fallback masks them, including the shared chat stylesheet. Preserve legitimate standalone fallbacks only for real roles.
6. Unify semantic control density, spacing and typography across site actions, history, demo, assistant and shared chat. Page actions remain about 42px, inline actions about 32px, coarse-pointer targets at least 44px where applicable. Preserve minimal flat layouts and no narrow-width overflow.

## Ownership and constraints

`public/ran-tokens.css` is generated dependency foundation and must not be edited. Reuse its real semantic roles first. If application density or semantic roles are missing, define a small explicit application layer in a shared owner, consumed by all relevant page heads and build/offline graphs. Do not invent new `--ran-*` names or scatter raw fallback values. Geometry such as breakpoints, borders, viewport dimensions, brand art and physical hit targets has documented exceptions.

Source generators own generated pages. Confirm-dialog owns modal integration; component state styling belongs to its public CSS hooks. Shared chat owns its defaults rather than relying on assistant overrides. Do not alter provider, storage, editor runtime, consent, OAuth or document contracts. Mixed interface/document languages are intentional.

## Acceptance

Add an automated first-party token audit covering all authored CSS, shared chat styles and HTML inline styles, with scoped role resolution and explicit custom-property ownership. Unknown roles must fail even with fallbacks; vendor/artwork/generated foundation assets are excluded. Include meaningful negative fixtures.

Browser regressions exercise real component public APIs, headers at narrow widths, all page types, light/dark and coarse pointers, disabled queue hover and semantic button sizing. Cover all seven locales using representative generated pages. Touch coverage explicitly includes speech microphone, privacy, cancellation, and result/plan actions; hidden controls must not reserve blank space and the composer must fit at 320px. Verify actual destructive button default, hover, active, disabled and keyboard focus styles in both themes, not only host hook declarations. Existing 45-page audit remains useful evidence but cannot substitute for failing CI contracts.

Run full unit coverage, formatting, lint/typecheck, production build and focused browser regression. Submit one PR with all fixes, verify every CI check and deployed preview, then independently review final changes. Do not merge.
