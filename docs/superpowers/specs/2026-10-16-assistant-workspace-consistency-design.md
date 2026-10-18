# Assistant workspace consistency

> Connector scope superseded on 2026-10-18: external MCP and Google Drive connections were removed. Local file references and artifacts remain. See the [investigation and product decision](../../explorations/2026-10-18-mcp-connectors-and-frontend-boundaries.md). The original plan below is historical.

## Scope and evidence

The owner requested uniform buttons, spacing and interactions across the AI workspace, explicitly using design-system tokens. PR #276 is already merged; this increment starts from `origin/main` (`2427b27`) and requires a follow-up PR. Prior approval for compact, flat UI and continued implementation remains in force.

Observed on the deployed preview: Sources commands are 38 px and native fields 40 px; model controls are 32 px; history management commands are 30 px. Sources has a separate back row, Artifacts places its list Back after Import, and model/history navigation relies on the global header. Native workspace headings vary between 16, 16.8 and 20/24 px. Code inspection found undefined `--ran-space-5` and `--ran-color-fill-secondary` usages, removing intended section spacing and hover feedback.

## Scope lock

- May change host `styles/assistant.css`, focused UI view composition (`sources-view.ts`, `artifacts-view.ts`, `settings-view.ts`, `panel.ts`, and their label adapter), a small local `view-header.ts` owner, existing/new host unit and browser tests, seven locale tables/types only if a new destination label is required, and design/acceptance docs.
- Keep the shared chat/runtime/provider/queue/storage/OAuth/native document contracts, vendor SDK, global ranui tokens, marketing pages and standalone page CTA scale unchanged. The site's documented 42 px page actions are a deliberate separate context.
- No new consent, implicit send/connect/download/save, destructive behavior or data format. Preserve pending-operation disablement, dirty-artifact confirmation, locale updates, navigation snapshots, IME, callback ownership and offline behavior.

## Design

Use existing tokens: `--ran-size-7` for 32 px desktop command frames; `--ran-text-label-3` for compact command labels, `--ran-text-label-2` for fields/list identity, `--ran-text-heading-3` for subpage titles, `--ran-text-label-1` for subsection titles. Use spaces 1/2/3/4/6 for 4/8/12/16/24 px relationships, `--ran-radius-sm` for controls, semantic background/foreground/border/link/danger tokens for every state. Do not invent missing ran tokens or replace them with arbitrary fallbacks. A host semantic control-size alias may combine these values; the existing 44 px coarse-pointer accessibility minimum is the only physical hit-target exception.

Ordinary commands are quiet ghost buttons with real enabled hover/pressed feedback. Explicit artifact save/accept commitments may use a compact primary treatment; destructive commitments remain clearly named and semantically styled. Disabled commands never look active or gain enabled hover. Resource and artifact rows keep readable identities and content-sized wrapping. Native and ranui fields share frame geometry; text editors/tables retain their content-driven sizes.

Use one flat header composition for Sources, Models, Conversations and Artifacts. Reuse the owner's actual heading and back button rather than moving navigation state into the helper. Back uses an ordinary accessible button with a small decorative chevron, consistent frame and destination-specific accessible label/tooltip. Each view continues to own its callback, localization and busy/dirty guards. Artifact list returns to conversation; editor/import returns to artifacts and preserves discard confirmation. Keep one back path per state and focus restoration after navigation; no footer Back mixed with save/import/export commands.

Keep titles, fields, help, lists and statuses on a shared 16 px inset. Use 8 px field/internal gaps, 16 px groups and 24 px sections. Remove invalid-token rules at their owner rather than layering a global override. Disclosures remain progressively revealed, scrollbars stay at the panel edge, and no new nested cards or ambient animation is added.

## Acceptance

Measure real browser geometry at 320/432 px panels and narrow windows, light/dark and coarse pointer. Check title/body leading edges, consistent control frames, real hover/pressed/disabled feedback, no overflow with long translations, and keyboard focus/return. Exercise Sources search/preview/attachment/connector failure, both model sources and advanced/offline visibility, history search/data confirmations, artifact list/import/editor/version/dirty Back/refine/export, result actions and queue. Controlled model/auth/voice responses remain explicitly distinct from real OAuth or model-quality validation.

The minimal alternative is CSS-only resizing; it cannot fix the inconsistent back path and busy/dirty ownership. A new UI framework or global component restyle is unnecessary. Adopt a small host-only header composition and existing view owners, then targeted regressions, full unit/coverage/lint/format/build and relevant browser suites, latest-head remote CI and final review.
