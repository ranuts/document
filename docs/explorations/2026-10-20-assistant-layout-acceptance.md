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

User review found that five independently outlined buttons still made History & data
look crowded, especially when translated labels changed the wrapping pattern. The
three transfer commands now share one quiet framed surface with aligned icon/label
rows. Each complete row remains a native button. Deletion commands occupy a separate
group with danger text and icons; a solid danger fill is reserved for confirmation.
The save-history checkbox uses the existing monochrome primary role.

The resting frame, full-row hover/press feedback, keyboard outline and decorative icons
make these commands discoverable without a border around every label. Group frames
remain on the 16px content rail; row frames, icons and labels align across both groups.
Long labels wrap within their row. Busy states retain geometry, localized labels survive
sync without removing icons, and the existing confirmation/cancellation/focus owner is
unchanged. Source attachment/removal and artifact save/apply/confirmation actions were
also inspected: they are contextual form actions and retain their existing hierarchy.

The history-action acceptance now measures group affordance, full-width non-overlapping
rows, minimum 44px targets, accessible names and actual contrast, rather than requiring
an individual outline on every command. English/Portuguese, 432px desktop panels,
360px/320px windows and both themes are inspected in Chromium, WebKit and Firefox,
including hover/press/disabled states, Enter/Escape, real export download and focus return.

![Grouped history commands in light mode](../media/assistant-layout/2026-10-20-history-commands-light.png)

![Grouped history commands in dark mode](../media/assistant-layout/2026-10-20-history-commands-dark.png)

![Portuguese history commands in a 320px dark window](../media/assistant-layout/2026-10-20-history-commands-320-dark.png)

Follow-up verification:

- The new group acceptance failed against the independent-button layout before implementation.
- Final production build: three Chromium and six Firefox/WebKit history-action cases
  passed without retries. The broader layout/history run also passed all 10 cases.
- Focused history controls, panel lifecycle and write-reply unit suites: 274 passed.
- Final `pnpm test`: all 252 files and 6,801 tests passed. The suite printed the same
  two non-fatal `PromiseRejectionHandledWarning` messages seen before this change.
  The coverage percentages above belong to the earlier layout-only coverage run.
- Lint/typecheck, formatting, production build and diff checks passed. Independent
  code review found no actionable issues; light/dark and narrow screenshots were inspected.
- The companion ran guidance now explicitly supports grouped command affordances and
  separates destructive intent from destructive confirmation without changing library defaults.

Border refinement after visual feedback keeps the 1px rounded outer frame and starts
internal separators at the label column, leaving the icon column uninterrupted. Lines
end at the trailing row inset and use the existing secondary border role. Decorative
pseudo-elements do not intercept input, change the row target or add another button box.
Light/dark and narrow renders were inspected and the three Chromium history-action
cases passed again without retries, including translated labels, touch targets, keyboard
focus, hover/press/disabled states and confirmation/cancellation. No runtime logic changed.
