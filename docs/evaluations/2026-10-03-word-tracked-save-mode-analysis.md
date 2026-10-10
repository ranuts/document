# Word tracked text Save/reopen and mode scope

The actual production Qwen3 1.7B IM path replaces selected `A😀pha\t` with `项目 😀 Payment · NOT approved`, preserves native character/review-type snapshots and Undo/Redo, saves through the visible document Save button and reopens that DOCX using the homepage file chooser.

[Initial report](2026-10-03-word-im-tracked-unicode-save-1_7.json) and [settings diagnostic](2026-10-03-word-im-tracked-unicode-save-settings.json) retain `allPassed: false`: the saved/reopened paragraphs and sampled bold/review-type characters match exactly, but the effective tracking switch is off after reopening. Before Save, local tracking is true and document/global tracking is false; after reopening, local tracking is null and global tracking remains false. The DOCX `w:trackRevisions` element has `w:val="false"`. Element presence alone does not mean tracking is enabled; the initial presence-only interpretation was corrected by inspecting the value.

## Native API distinction

The shipped Word API defines `asc_SetTrackRevisions` as a wrapper for `asc_SetLocalTrackRevisions`. `CDocument.IsTrackRevisions` uses local tracking if non-null, otherwise document settings. `asc_SetGlobalTrackRevisions` changes persistent document settings through a native history action. The current IM checkbox and `set_review_mode` tool call the local wrapper.

The [no-AI control](2026-10-03-word-native-tracked-unicode-save-control.json) uses native `pluginMethod_PasteText` with local tracking enabled, with no model planning. It reproduces exact saved/reopened character and paragraph snapshots while the effective tracking switch turns off. Its overall result also remains false. Two retained probe wiring diagnostics ([enterText](2026-10-03-word-native-tracked-unicode-entertext-diagnostic.json), [PasteText](2026-10-03-word-native-tracked-unicode-pastetext-probe-diagnostic.json)) passed the Locator element as the API text argument; their failures do not establish native SDK defects. The corrected control supplies the text as Locator.evaluate's second argument.

## Persistent-setting feasibility

The [document-level probe](2026-10-03-word-im-tracked-unicode-save-global-probe.json) enables `asc_SetGlobalTrackRevisions(true)` and clears the local override with `asc_SetLocalTrackRevisions(null)` before the actual IM replacement. It passes the original full comparison, including the effective tracking mode after reopen. The DOCX contains `w:trackRevisions w:val="true"`; local tracking is null and global/effective tracking true both before Save and after reopen. No model-text changes or conversion fixes are needed for this case.

This is a native setup probe, not a product fix to the existing checkbox or tool. The next implementation should unify those two entry points with the intended document-level mode while retaining native Undo, readonly/locked-setting behavior and stale-action checks, without additional UI or confirmation. Native setting changes can create history points, so this must be covered by transaction tests and real IM Stop/Undo regressions rather than treating it as a setter substitution.

## Verification limits

Reports contain source/file SHA-256 metadata and preserved negative results. Exported revision nodes contain author/date attributes and the deleted tab, but these probes do not compare complete revision author/date metadata before and after Save. All recorded character styles are limited to raw bold and review type; full styles, links, bookmarks, all configured models, external Word, OS overwrite and physical mobile behavior are unverified. This follow-up changes no production code. Repository lint passes; previous production build and 4040-test verification apply to the unchanged implementation. The broad local-AI goal remains active.

## Product correction

The existing checkbox and `set_review_mode` tool now use one document-level setter. It rejects loading/readonly/view contexts and unsupported settings APIs, checks the SDK's runtime document-settings lock before either setter, writes global tracking through the native history action, verifies that write, and then clears the local override. Post-write failures retain concise check-document/Undo guidance. Locked settings produce explicit bilingual no-change guidance.

The checkbox reads effective tracking even when disabled. SDK tracking callbacks update it after native Undo/Redo; callbacks are removed on document replacement/pagehide. The shipped SDK callback registration is additive, so the native toolbar handlers remain registered. Programmatic checkbox synchronization does not call the setter.

Actual production Qwen3 1.7B IM evidence on the corrected build:

- [Visible checkbox](2026-10-03-word-im-tracked-unicode-save-ui-fixed.json): document-level enable, exact native toggle Undo/Redo and corresponding checkbox states, tracked Unicode/tab selection replacement with unchanged neighbors and exact text-edit Undo/Redo, native Save and homepage reopen with tracking still enabled and identical sampled paragraphs/characters.
- [Locked settings](2026-10-03-word-im-tracked-unicode-save-ui-locked-fixed.json): controlled native settings lock refuses disabling tracking, keeps checkbox/global/effective state, and preserves native history index and point/item identities; after releasing the controlled lock, the same tracked Save/reopen scenario passes.
- [Matching global / conflicting local](2026-10-03-word-im-tracked-unicode-save-ui-override-locked-fixed.json): global tracking already true, local override false, and settings locked. Enabling is refused without clearing the override, changing the checkbox/history, or altering text. This covers the lock/readback blind spot found in review. The probe clears its temporary override only after releasing the lock, then performs the normal IM Save/reopen check.
- [Actual IM mode instruction](2026-10-03-word-im-tracked-unicode-save-tool-fixed.json): Chinese “启用当前文档的修订模式” chooses the real local-model tool, shows concise checked-result feedback, produces no errors or previews, and passes toggle Undo/Redo plus the subsequent tracked replacement and Save/reopen checks.

The [hidden-settings diagnostic](2026-10-03-word-im-tracked-unicode-save-ui-hidden-settings-diagnostic.json) records a probe that attempted to click before opening the existing settings section. The [guidance diagnostic](2026-10-03-word-im-tracked-unicode-save-ui-locked-guidance-diagnostic.json) retains the intermediate generic-error failure even though native state/history were preserved. Final probes use the existing gear toggle and explicit trusted lock message. Historical negative reports remain unchanged.

Production build, 114 test files / 4047 tests and repository lint pass. Seven new tests cover document-level setting behavior, locked matching settings, readonly/view guards, SDK callback synchronization/cleanup and lock-message rendering. Full-suite converter tests still print the previously investigated asynchronous rejection-handled warnings. Independent review identified and verified the error-field and matching-global lock fixes; no Important/Critical issues remained in the corrected logic.

These are cached-model isolated desktop tests. Native settings locking is deliberately injected, not a complete protected-document compatibility test. Local overrides from the native toolbar are cleared when choosing document-level mode; native Undo restores document settings, not an earlier session-only override. All-model mode-setting instructions, real protected files, every Stop timing, complete revision metadata, external Word and physical mobile devices remain separate validation work. No additional UI controls, preview cards or confirmation steps were added.
