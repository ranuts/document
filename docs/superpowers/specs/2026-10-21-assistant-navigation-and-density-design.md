# Assistant navigation and command density correction

## Goal and authority

The owner rejected the rendered History & data button cloud and the artificial
Back/title hierarchy in Artifacts. Correct those surfaces and analogous Models,
Conversations and Sources views; inspect real screenshots before updating PR #289.
The follow-up requests polished visual craft and purposeful motion.

Use [ran DESIGN.md](https://github.com/chaxus/ran/blob/main/packages/ranui/docs/DESIGN.md)
sections 2, 3, 8, 11 and 12. The owner's correction supersedes the previous
application-specific 48/54px heading lane and gutter-extended history targets.

Industry references: [Linear's UI refresh](https://linear.app/changelog/2026-03-12-ui-refresh)
uses consistent navigation, headers and control hierarchy;
[Notion's sidebar](https://www.notion.com/help/navigate-with-the-sidebar) distinguishes
parallel top-level destinations from nested pages. These inform composition, not
a copied palette, framework or visual identity.

## Scope lock and verified assumptions

| Evidence                                                                                             | Consequence                                                                         |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| User screenshots show large irregular history command surfaces and an indented Artifacts heading     | Review the entire pane, including resting state and density                         |
| `panel-workspace.ts` owns chat/settings/history/sources/artifacts visibility and focus               | Keep navigation state with this owner                                               |
| `panel.ts` mounts all workspace triggers in the header; title returns to a recent/draft conversation | Keep the existing title behavior and add an explicit current-chat navigation action |
| `artifacts-view.ts` owns list/import/editor, dirty drafts, async cancellation and confirmation       | Remove only its list-level Back; retain nested Back and all guards                  |
| `history-controls.ts` owns storage, downloads, busy guards and confirmation                          | Change its presentation, not persistence or operations                              |

May edit assistant view composition, shared assistant CSS, seven locale labels,
related unit/browser tests and application design/acceptance documentation.
Do not change vendor files, packages' runtime/data contracts, dependency versions,
model defaults, document writes, persistence formats or inference consent.

## Chosen composition

- Keep one quiet header with AI Assistant, New conversation and Close.
- Place visible, persistent destinations beneath it: Chat, Artifacts,
  Conversations, Sources and Models. Reuse current trigger nodes and the
  workspace lifecycle; navigation selection is idempotent. A current-chat entry
  preserves the displayed draft rather than selecting another conversation.
  Narrow/translated navigation may scroll horizontally; no destination disappears.
- All top-level h2 text, explanatory copy, search/field/list frames and history
  command frames use the same 16px content inset. Top-level views have no Back.
- Show runtime preparation/status only in Chat or the existing Models owner.
  It must not insert an unrelated status band above Artifacts/Sources.
- Use a 16px section heading in the auxiliary pane. Give title/description a
  smaller gap than description/actions. Nested artifact Back is labeled and
  precedes the title, allowing the title to return to the same content inset.
- History commands form one equal-width, medium-density secondary column: 32px
  minimum on fine input and 44px on coarse input, neutral resting control stroke,
  no heavy gray fill or enclosing card. Checkbox and action icons share a 24px
  lane; labels share 48px, measured from the pane's inside edge. Status text
  follows its associated checkbox label. Use 8px inside action groups and 16px
  before destructive commands. Preserve danger foreground and explicit confirmation.
- Import/Attach open a workflow, so use ordinary secondary affordance. Save or
  accept a concrete reviewed result remains a monochrome primary commitment.
- Optional motion is a short opacity-only entry using ran's fast duration and
  existing easing. No layout travel, blur, skeleton, delayed focus or new library.
  Reduced-motion disables it; hover/focus feedback stays immediate.

Alternatives rejected: keeping a Back row on each parallel view repeats navigation;
a destination dropdown hides discoverability; a new app-wide shell or design system
is unnecessary. Reuse native controls and the existing presentation owner.

## Acceptance

Capture full panes before/after, not just button crops: History expanded and
confirmation; Artifacts empty/list/import/editor/return; Sources empty/populated;
Models local/service/expanded; Chat and narrow navigation. Inspect light/dark,
320/360px windows and the 432px desktop pane, English/Portuguese, fine/coarse
input, keyboard focus, resizing and reduced motion. Verify current-chat drafts,
artifact unsaved-change recovery, source actions, deletion cancellation/downloads
and no automatic inference on navigation. Use independent browser coordinates
and contrast checks alongside visual review; reverse-check text/frame drift.
Record screenshots and findings. Only push/update the PR after the visual review
and applicable lint/type/format/build and related regression checks pass.
