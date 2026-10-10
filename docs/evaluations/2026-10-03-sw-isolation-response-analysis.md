# Cached response isolation: Worker-global gate rejected, script-URL candidate verified

No production source or hosting headers changed in this evaluation. IM UI is unchanged.

## Rejected gate

The initial implementation gated header repair on `self.crossOriginIsolated` in the Service Worker. Its VM regression tests passed (59 tests with sw-update tests), but actual Chromium 151.0.7922.34 contradicted that assumption: the isolated main document had `crossOriginIsolated === true`, while the actual Service Worker reported `false` (boolean). Its cached iframe and dedicated Worker therefore remained blocked. The candidate was removed from `public/sw.js`; the regression test based on the invalid assumption was archived as text, not retained as a passing production test.

`sw-isolation-global-candidate.txt` preserves the rejected candidate. `probe-sw-isolation-response-initial.txt` preserves the diagnostic harness, including an appended message listener that reports the actual Worker-global value. The two diagnostic JSON files preserve the observed failures before the fix.

## Explicit mode candidate

`sw-isolation-query-candidate.txt` changes the gate to the registered script URL's `isolation=1` parameter. This survives Worker restarts without relying on a volatile handshake or on the Service Worker's own isolation capability. The browser harness explicitly registers this candidate URL; production registration has not been changed.

The candidate streams the existing response body into a new Response with COOP `same-origin` and COEP `require-corp`. Status, statusText and other headers are retained. Nonisolated mode, responses already carrying these policies, and status-zero errors pass through. Vendor cache-first, offline navigation and other static response strategies share the wrapper. Foreign requests and existing font/spellchecker exclusions remain unchanged.

## Actual browser evidence

Run `node docs/evaluations/probe-sw-isolation-response.mjs` with the existing preview on port 5193. It serves the archived candidate script via an isolated Playwright context. Synthetic same-origin cached responses contain the exact iframe marker and a Worker that reports its own isolation capability; neither stored response carries isolation headers.

The offline navigation route is removed before reloading, so Playwright cannot fulfill the main document while offline. This closes a review finding in the initial candidate harness.

The final JSON records:

- Service Worker global isolation remains false.
- Main document, iframe marker and dedicated Worker load successfully online and offline.
- The delivered Worker response carries COEP `require-corp`.
- Offline navigator state is false and an uncached request fails.
- Both original cache entries retain their original bodies and still have no COEP header. The candidate repairs delivery rather than rewriting stored metadata.

The `passed` field checks each of these invariants, except the Service Worker global value is diagnostic rather than a success requirement.

## Remaining integration work

This is candidate-level compatibility evidence, not a native Word/Excel/PPT, real-model, first-upgrade, or deployment pass. Enabling the mode requires consistent landing/editor registration and controller waiting, coverage of migration from an already controlling old worker, and native HTTP-cached spellchecker startup/offline verification. Global isolation headers remain disabled until those checks pass. This evaluation avoids shipping the invalid global gate or adding UI controls.
