# Three-type saved-session migration after the prefetch fix

The local artifact migration gate passes with normal product prefetch enabled and a reactive controllerchange observer. This closes the tested three-type saved-session workflow; it does not ship the experimental native CSP or complete the broader local-assistant/device/security goal.

## Genuine artifacts and upgrade paths

Two successful builds of committed product fix `87cf58f` reside in `/private/tmp/document-two-build-prefetch-fix`. Baseline core/vendor: `1791042221` / `7d29d51909fb`; candidate: `1791042230` / `d4218b4014f8`. Each full vendor tree has 2,542 files, and the preparation helper checks the complete relative-path/content digest against the generated stamp. Both effective landing-prefetch files match the committed source bytes. Candidate native CSP/static stylesheet inputs are baked before its build, as in the earlier experiment; no serving bytes or stamps are rewritten.

The [same-revision build pair](2026-10-03-sw-prefetch-fix-reactive-three-types.json) verifies Word, Excel and PowerPoint in separate fresh contexts. A second [before/after source migration](2026-10-03-sw-prefetch-before-after-migration.json) starts from the already-built baseline of `75b6551` and upgrades to the genuine candidate of `87cf58f`. Its manifest explicitly has different sourceCommits, references to the original immutable artifact directories and sourceCommit=null; it is not misrepresented as one source archive. The assembly helper verifies full vendor digests, entry/SW/header hashes and each revision's prefetch bytes before creating symlinks. The old prefetch hash differs from the new one.

Installed dependencies/workspace symlinks remain shared, so the builds are not hermetic. Local isolation/MIME/Brotli/CSP responses are not deployed edge delivery evidence. The candidate native policy still permits legacy unsafe-eval and broad connections, and covers the main native entries rather than all embed/plugin/remote-URL paths.

## What passes

All three types retain their sampled dirty text under the old controller while the correct candidate is installed/waiting, then complete a visible native Save. After landing navigation, an event observer receives controllerchange and an explicit VERSION query verifies the actual candidate core/vendor. The old saved download reopens with exact sampled text.

Candidate insertion, native Undo/Redo, visible-toolbar Save and exact sampled-text reopen complete for each type. Same-context offline navigation retains isolated shell/iframe and cached native response policy, rejects an uncached fetch, blocks inline/event/controlled-foreign scripts and records zero upstream responses. The Save button remains hit-testable. These text/control checks are not arbitrary formatting/metadata fidelity, offline spelling, model tool inference, process-cold startup or physical devices.

Both reports have passed=true and completeMigrationPassed=true for this defined artifact workflow. The reactive driver has stopPrefetch=false; no fixed quiet interval, manual promotion, old-Worker stopping, cache clearing or skipped old checkpoint is used. Controllerchange occurs before the first VERSION query, and fetch observation finds no landing prefetch before that event. Warming legitimately resumes afterward; one loader fetch starts after the event but before the observer records its Promise continuation, which is expected rather than a pause failure.

## Retained negative observation

The initial [frequent-query run](2026-10-03-vendor-csp-two-build-prefetch-fix.json) still fails its 20-second bound. A [registration/script trace](2026-10-03-sw-prefetch-fix-upgrade-trace.json) confirms the effective repaired script bytes, an installed application waiting Worker and no prefetch-originated fetch. Switching only the observation style then permits the tested migration. The earlier unrepaired product also failed the same reactive observation with warming enabled, while runtime stopWarming permitted it. Together these delimit the product improvement and a remaining interaction with observation timing.

Do not infer that the new product is universally immune to Worker messaging traffic, that a specific Chromium internal task is defective, or that an old controller can never activate later. The frequent-query reports are not deleted or reclassified as passes. The event observer introduces no Worker queries during its wait; it verifies VERSION only afterward, so event receipt alone cannot masquerade as the candidate version. Its diagnostic fetch/event logging remains a timing instrumentation boundary.

## Verification and preserved files

`verify-sw-prefetch-migration.py` checks both three-type reports, unchanged probes/drivers, absence of diagnostic prefetch intervention, real artifact/source hashes, old/candidate exact sampled text, native/ offline controls and retained negative observations. The preparation helper's record pass recomputes the new builds' full vendor fingerprints. Six synthetic old/candidate native downloads are copied into the before/after lab's saved-evidence directory with a manifest bound to the final report hash; old saved hashes are checked against the report before archiving. Later scratch downloads cannot silently replace this evidence. The archive is local temporary evidence, not a user document or durable checked-in artifact guarantee.

Both builds, scoped verifier, JS syntax, lint and diff checks pass. Product source is unchanged in this turn; the preceding product commit's full unit suite and landing E2Es are not unnecessarily repeated. Remaining gates include deployed CSP delivery, embed/plugin/remote compatibility, other browser/device behavior, semantic writing quality and final IM appearance/interaction.
