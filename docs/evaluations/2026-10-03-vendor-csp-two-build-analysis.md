# Independent vendor builds: blank control passes, saved-session migration fails

The vendor CSP remains unshipped. Two real local builds replace the synthetic-stamp proxy as an artifact-level experiment, but they do **not** pass the complete migration gate. Blank old sessions upgrade and complete native text workflows for Word, Excel and PowerPoint. An old Word session that edits and saves before leaving for the landing page remains on the old Worker despite a correctly installed candidate and a delivered promotion request. No product fix is made without a confirmed cause.

## Artifacts and boundaries

The source archive is commit `75b6551`. Two successful `pnpm build` invocations run outside the checkout in `/private/tmp/document-two-build-csp`. The baseline is unchanged. Before the candidate build, the three native main entries replace the async stylesheet event attribute with static `media="all"`, embed exact inline-script hash CSP in HTML, and add matching `_headers` rules. Candidate policy retains the legacy `unsafe-eval` and broad connection permissions; it is not a complete isolation or exfiltration boundary.

The build script fingerprints all 2,542 vendor files with relative paths, including contents. The preparation helper recomputes this full digest and matches each build-generated stamp. Baseline core/vendor: `1791034617` / `7d29d51909fb`; candidate: `1791034692` / `d4218b4014f8`. No SW stamp or HTML bytes are rewritten by the test server. Its candidate headers come from the artifact manifest, which is checked against the baked `_headers` rules. The local server implements required isolation, MIME and Brotli transport; this is not a deployed Pages/Docker/edge response acceptance.

Installed dependencies are deliberately shared. `node_modules/@ranuts/*` resolves to the existing checkout's workspace packages; these are **not two hermetic builds using only the archive**. Product source was unchanged during both invocations. The experiment establishes the specific vendor artifact bytes and stamps, not a general reproducible-release guarantee. No vendor CSP, UI, product dependency or deployment changed.

## Verified controls

The [three-type blank-session control](2026-10-03-vendor-csp-two-build-blank-control.json) uses one independent Chromium context per document type on a local origin. It warms policy-free old native entries, changes the server's artifact directory, and explicitly polls the controlling VERSION. All three types acquire the real candidate vendor version and effective native CSP response before mutation.

Each then inserts a marker, removes it with native Undo, restores the sampled text with Redo, clicks the visible native Save button, and reopens the downloaded file with exact sampled text. Same-context offline navigation reports isolated shell/iframe, actual cached native CSP, an uncached fetch rejection and zero upstream responses. Inline, event-handler and controlled foreign-script probes are blocked with corresponding CSP violations; the native Save button is hit-testable. Legacy eval deliberately remains allowed. These text snapshots are not a full style/metadata fidelity proof, model/IM inference, process-cold offline test or physical-device matrix.

This report's `passed=true` describes those blank-session workflows. Its explicit `completeMigrationPassed=false` prevents treating the skipped old-edit/save checkpoint as complete acceptance.

Two [bare SW](2026-10-03-sw-minimal-promotion.json) and [native Blob-download](2026-10-03-sw-minimal-promotion-download.json) controls both deliver the switch message and acquire their new controller. A simple browser download alone is therefore insufficient to reproduce the saved native-editor failure. These controls do not exercise product caches or conversion.

## Saved-session failure and causal limits

The [current saved Word regression](2026-10-03-vendor-csp-two-build-saved-regression.json) keeps `OLD_UNSAVED_docx` unchanged under the baseline controller while the candidate waits installed, then completes a real native save. On the subsequent landing page, every recorded controller observation still reports the baseline vendor. The waiting VERSION is the correct candidate; CLIENT_COUNT reports one window and zero editors. The landing lifecycle records the loaded updater and `SKIP_WAITING`. There are no page errors. The bounded current run fails at 20 seconds; the earlier [lifecycle diagnostic](2026-10-03-vendor-csp-two-build-lifecycle-diagnostic.json) records the same state throughout a 120-second window. Neither proves the browser can never transition later.

Further retained diagnostics narrow the next investigation:

- [Disabling the foreign-script route](2026-10-03-vendor-csp-two-build-no-route-diagnostic.json) still fails, so that route alone does not explain it.
- The [message/target diagnostic](2026-10-03-vendor-csp-two-build-events-diagnostic.json) identifies the actual candidate by its Worker constants, observes receipt of `SKIP_WAITING`, and bounds a direct native `self.skipWaiting()` call. That Promise does not resolve within the diagnostic bound; the old VERSION remains after a quiet interval.
- In the [old-Worker stop diagnostic](2026-10-03-vendor-csp-two-build-stop-old-diagnostic.json), stopping the identified old CDP Worker after the failed switch is followed by candidate activation and the candidate controlling VERSION. This is an isolated debugger intervention, **not a product recovery strategy or an accepted migration**.
- Server pending requests are empty at the checkpoint. This does not establish that old extendable events, response bodies or cache writes are settled. Old Worker instrumentation fields are absent after its restart, so the [cache diagnostic](2026-10-03-vendor-csp-two-build-cache-diagnostic.json) cannot certify the old Worker has zero pending events. Do not infer a specific cache.put defect from missing fields.

The [Service Workers draft activation algorithm](https://www.w3.org/TR/service-workers/#try-activate-algorithm) requires the active Worker's pending events to be clear before activation under its stated conditions. This motivates tracing the saved session's old Worker lifetime. The observed stop/activation sequence supports an old-Worker-associated obstruction; it does not yet identify a particular event, API, browser defect or product code line. Adding more retries, clearing document/model caches, or silently terminating workers would not be an evidence-based fix.

One diagnostic introduced an unbounded Worker evaluation. Its [harness termination record](2026-10-03-vendor-csp-two-build-unbounded-harness-diagnostic.json) records the explicitly terminated owned process and missing final report. The operation now has a separate bound. It is not counted as a product failure or a completed experiment. Earlier diagnostic probes differ from the current source hash; only the final blank control, saved regression and current minimal controls are required to match their current probes.

## Reproduction and checks

For a new lab directory, run `TWO_BUILD_ROOT=/private/tmp/document-two-build-new python3 docs/evaluations/prepare-vendor-csp-two-build.py`. It refuses to overwrite an existing lab. The installed dependency links remain shared. `... prepare-vendor-csp-two-build.py record` verifies existing artifacts and regenerates only their manifest, including the full vendor digest. Build logs remain beside the temporary artifacts.

Run the default `probe-vendor-csp-two-build.mjs` with a unique `TWO_BUILD_REPORT` to exercise old edit/save migration. `TWO_BUILD_SKIP_OLD_CHECKPOINT=1` selects the separate blank-session control. Diagnostic switches are recorded in `experiment`; manual calls and old-Worker stopping must never be described as automatic product acceptance. The minimal probe's `MINIMAL_DOWNLOAD=1` adds the native Blob-download control; use a unique `MINIMAL_REPORT`.

The [verifier](verify-vendor-csp-two-build.py) checks current probe hashes, final report scopes, artifact hashes, old dirty/save checkpoints, control versions and three-type native/offline rows while requiring the migration gate to stay false. Both temporary builds, scoped verifier, JS syntax, lint and diff checks pass. Product source is unchanged, so the full unit suite was not repeated. Remaining gates include the saved-session cause/fix, deployed hosting delivery, embed/remote URL/plugin compatibility, semantic model quality and physical devices.
