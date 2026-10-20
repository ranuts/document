# Assistant layout contract acceptance

Date: 2026-10-20

## Result and scope

The assistant now shares a 16px content rail across its header, onboarding, Models,
Conversations, Sources and Artifacts. Navigation headings use a declared second rail
(48px for fine input, 54px for coarse input), while the back icon viewport returns to
the content rail. A framed control's text keeps its own inset; its frame, text and
hit area are measured separately.

The companion [ran PR #434](https://github.com/chaxus/ran/pull/434) defines the reusable
composition and acceptance rules. It changes guidance and test examples, so this
consumer does not need a dependency upgrade. Product dimensions remain in
`styles/assistant.css` and [the application design contract](../design-system.md#assistant-application-layout-contract).

## Inspected surfaces

| Surface                | Rendered acceptance                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| Onboarding             | Header, welcome heading and explanatory text share the content rail                                           |
| Runtime header/chat    | Actual title text and compact hover area; visible actions; draft retained on return                           |
| Models                 | Heading/navigation rails, picker frames and actual ranui selection-item text; internal control inset retained |
| Conversations          | Search frame, empty state, populated conversation text and History & data disclosure                          |
| Sources                | Intro/search group gap, search frame, attached reference preview, expanded excerpt and status                 |
| Artifacts list         | Empty explanatory text, populated list, Import action and their group gap                                     |
| Artifact import/editor | Shared header after async refresh, form labels/fields, save and return to list/chat                           |

The geometry matrix exercises a 432px desktop panel, 360px and 320px windows,
English and Portuguese, both themes, fine and coarse input, and long synthetic
translations. Header targets stay inside the panel, do not overlap, and retain
44px minimum dimensions with coarse input. At widths up to 360px the readable
title occupies a row above the five actions. Keyboard checks establish
`:focus-visible`, inspect the complete back-button outline and return with Enter.

Representative current renders:

![Models at 320px with Portuguese labels and a readable two-row header](../media/assistant-layout/2026-10-20-models-320-light.png)

![Populated Artifacts in dark mode with a separate Import group](../media/assistant-layout/2026-10-20-artifacts-432-dark.png)

## Failures caught before the fixes

| Evidence                   | Before                                                     | Accepted result                   |
| -------------------------- | ---------------------------------------------------------- | --------------------------------- |
| Title text Range           | 24px despite a correctly placed outer button               | 16px                              |
| Welcome copy               | 28px                                                       | 16px                              |
| Title hover                | Expanded into toolbar filler                               | Text width plus 16px padding      |
| Narrow translated header   | Truncated by five adjacent actions                         | Readable title above action row   |
| 432px coarse header        | Title inherited a 44px icon flex basis                     | Title keeps its own content basis |
| Coarse back focus          | 2px gutter could not contain a 2px outline plus 2px offset | Zero offset; full outline visible |
| Sources intro/search       | No group separation                                        | 16px                              |
| Populated artifacts/Import | No group separation                                        | 16px                              |

The tests also inject an 8px text-only drift while retaining the same outer width,
expand the title into flexible filler, and shift a sibling view's padding. Each
mutation must fail the acceptance assertion, and restoration must pass. This
prevents an aligned wrapper or a stored screenshot from becoming false evidence.

## Verification

- `pnpm test:coverage`: 252 files and 6,801 tests passed. Coverage: statements
  87.79%, branches 83.94%, functions 88.77%, lines 90.25%.
- `pnpm lint:ts`, `pnpm format:check`, `pnpm build` and `git diff --check` passed.
  Archive verification retained all 1,511 immutable evaluation artifacts.
- The related Chromium navigation/workspace/source/artifact/history regression run
  passed 23 tests. The expanded final layout suite adds populated conversation and
  source disclosure coverage; its seven cases run in Chromium, Firefox and WebKit.
- Final layout acceptance: Chromium 7 passed; Firefox/WebKit 14 passed. All three
  browsers ran with retries disabled.
- Review findings about coarse title sizing and focus clipping were fixed and
  checked against a fresh production preview.

The first full coverage attempt overlapped browser work and hit an existing 5s
file-read timeout; the isolated complete rerun passed. A newly added populated
conversation fixture initially omitted legacy session metadata; correcting the
fixture made that case pass without a production logic change.

These checks cover assistant composition and related interactions. Native browser
zoom and the full repository browser/Docker suite are outside this focused run.
Persistence, model loading, document writes and dependency versions are unchanged.

## Follow-up: grouped history commands

History & data now uses flat native command rows inside the established settings pane.
Restore/Import/Export share icon/label columns and full-width targets, with a 16px gap
before the destructive commands. There is no inner group outline, group fill, row rule,
deletion divider or transparent border retaining an obsolete card inset. Hover/press,
keyboard focus, disabled states and the explicit danger confirmation remain distinct.

An earlier framed group, followed by inset separators, still repeated the pane's existing
boundary. The final revision removes that enclosure instead of making its lines more subtle.
Acceptance measures full-row geometry, contrast and interactions without requiring a
decorative group frame, and records the complete pane as well as the command region.

The runtime baseline after adding icon/label rows passed all 252 unit files / 6,801 tests
(including 274 focused history/panel/write tests), lint/typecheck and the production build.
Two existing non-fatal `PromiseRejectionHandledWarning` messages were printed. The final
flat-composition revision changes CSS, browser acceptance and prose; runtime logic is unchanged.
The coverage percentages above belong to the earlier layout-only coverage run.

## Revision scope: remove redundant command enclosures

The user rejected the remaining nested-box appearance. This revision applies ran's existing
composition rules (avoid redundant nested containers; establish hierarchy with type and spacing)
to the complete settings pane rather than refining a cropped card in isolation.
The starting evidence below refers to document `515e7ba6` and ran `911ee0853`.

| Assumption                                                                             | Evidence                                                                                | Decision                                                                         |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Existing guidance already discourages decorative nested frames                         | Code fact: ran `packages/ranui/docs/DESIGN.md`, composition and spacing sections        | Clarify how this wins over the optional framed-command example                   |
| History has a section divider, a transfer frame, row separators and a deletion divider | Code fact: `styles/assistant.css`, history options/transfer/danger rules; renders above | Retain the major section boundary; remove the three redundant command treatments |
| Group framing is currently required by acceptance                                      | Code fact: `test/e2e/agent-history-actions.spec.ts`, resting group assertions           | Verify full-row geometry and interactions without mandating an enclosure         |
| Native controls own persistence, confirmation and focus                                | Code fact: `lib/agent-plugin/ui/history-controls.ts`                                    | Leave runtime code unchanged                                                     |

Allowed changes: ran's `DESIGN.md`, `INTERFACE_GUIDE.md`, English/Chinese design-guide
entry points; document's assistant CSS, existing history-action browser acceptance,
design contract, this acceptance record and history command/full-pane screenshots.
Forbidden changes: tokens, component defaults/APIs, dependency versions, vendor files,
history/state/storage code and unrelated site layouts.

Compatibility red lines: keep the panel boundary, field borders, keyboard focus outlines,
44px targets, icon/label columns, accessible names, destructive confirmation and draft/focus
return behavior. The simplest composition is a flat command list with one 16px gap before
destructive actions. It needs no replacement card, muted group fill, shadow or new abstraction.

Acceptance: inspect the whole pane and its command region in both themes and at desktop,
360px and 320px widths; use the existing English/Portuguese, pointer/keyboard, disabled,
contrast, download, touch and confirmation checks. Verify the documentation and formatting
gates in ran. The review must explain the purpose of each remaining stable boundary.

## Remaining boundary review

| Surface                | Boundary retained                                              | Distinct purpose                                                            |
| ---------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Assistant/editor       | Panel edge                                                     | Independent sidebar and resize boundary                                     |
| Models and Sources     | Picker/search/input frames                                     | Values that can be edited or selected                                       |
| Conversations          | Search field and one History & data section rule               | Search input and a major change from conversation browsing to data settings |
| History command groups | None at rest                                                   | Title, icon/label columns and proximity already express grouping            |
| Command focus          | Keyboard outline                                               | Transient focus state, not decorative containment                           |
| History deletion       | Solid confirmation button                                      | Explicit destructive commitment after the existing confirmation step        |
| Artifacts              | Form/control boundaries and task-specific save/apply hierarchy | Editable values and explicit document/result operations                     |

![Complete Conversations pane with flat commands](../media/assistant-layout/2026-10-20-history-pane-light.png)

![Flat history commands in light mode](../media/assistant-layout/2026-10-20-history-commands-light.png)

![Flat history commands in dark mode](../media/assistant-layout/2026-10-20-history-commands-dark.png)

![Portuguese flat commands at 320px](../media/assistant-layout/2026-10-20-history-commands-320-dark.png)

Final flat-composition verification: the history/layout Chromium suite passed all 10 cases;
the Firefox/WebKit history-action suite passed all six cases. Retries were disabled.
The updated row-edge acceptance first failed on the old enclosure's 2px reduction in
available target width, then passed after the redundant frame/insets were removed.
Ran documentation/link/eight-locale checks and changed-file formatting passed.
