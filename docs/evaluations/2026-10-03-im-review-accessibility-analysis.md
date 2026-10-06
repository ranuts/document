# Review-mode accessible name

[Production baseline](2026-10-03-im-accessibility-controls.json) records the actual IM accessibility tree with settings closed and open. The review-mode control appeared as an unnamed checkbox followed by unrelated text `Review mode`. The ranui component exposes a checkbox role on its host and hides its internal native input from the accessibility tree; wrapping the custom element in a label did not name that host.

The existing localization effect now sets the host's `aria-label` to the same translated review-mode string as the visible label. No control, setting or interaction was added. A regression test failed before the change and passes afterward.

[Final production verification](2026-10-03-im-accessibility-controls-fixed.json) shows `checkbox "Review mode"` in the actual accessibility tree. Focusing the host and pressing Space changed the native Word API's revision state from false to true and set `aria-checked` to true; a second Space restored the original state. No page errors were captured. Production build, lint, all 110 test files (3960 cases) and independent review passed.

This verifies this control's English accessible name and keyboard/native-state synchronization. Localization uses the existing language effect, but browser tests for every language and real screen-reader sessions were not run. The snapshots are evidence for the controls they expose, not a full accessibility compliance audit of the custom components, editor or IM.
