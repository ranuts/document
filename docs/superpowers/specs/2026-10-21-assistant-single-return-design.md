# Assistant single-return correction

The previous visual acceptance missed a composition defect: the shell's Chat return and
the artifact editor/import return were visible together. The local layout contract even
allowed both. This follow-up corrects that contract under the user's existing authorization
to simplify navigation and verify actual screenshots/recordings before updating the PR.

- The shell owns one visible return location. An artifact detail/import returns to the
  artifact list; the list returns to the displayed Chat. Other secondary root views return
  to Chat. No second content-area Back row remains in the composed application.
- Retain artifact-owned dirty confirmation, cancellation, busy state, localization and
  draft lifetime. A central return must execute the existing operation rather than bypass it.
- Escape follows the same visible hierarchy when it is not consumed by an active control.
- Remove redundant nested collection chrome where the shell already establishes its context.
  Preserve actual document contents and explicit editing/version commands.
- Measure visible glyph/text ranges and icon viewports separately from hit frames. Quiet
  artifact command groups must start on the content spine, including wrapped rows. Do not
  move bordered field text out of its intentional control inset.
- Validate list/detail/import, dirty cancel/discard, version changes, back-to-chat draft and
  selection restoration, keyboard focus, busy state, English/Portuguese, light/dark,
  desktop and 320/360px coarse input. Capture complete panes and an actual recorded path.
- Update the existing application PR only after direct image/video review. Do not relax
  screenshot tolerances or behavior assertions. Update ran only if the defect is upstream.
