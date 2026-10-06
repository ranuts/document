# Isolation response policy registration and native-editor upgrade

## Product change

The landing page, editor registration and first-editor controller wait now choose `/sw.js?isolation=1` when the actual document is cross-origin isolated; nonisolated documents continue using `/sw.js`. The script URL persists the chosen mode across Service Worker restarts, avoiding the disproved assumption that the Service Worker global shares the page's isolation capability.

In that mode the worker adds COOP `same-origin` and COEP `require-corp` when delivering same-origin cached responses that lack the policy. It reuses the body stream and preserves status/statusText and other headers. Already compliant responses and status-zero errors pass through. The existing caching strategies and spellchecker/font bypasses remain intact. Model caches are still protected by the preceding ownership fix.

No UI controls or preview cards were added. Global hosting headers are not enabled by this commit; the policy is exercised on an isolated local HTTP proxy.

## Verification

- TDD: 5 expected failures before implementation: three cached response branches, isolated registration, and the missing URL helper. The source-based response test deliberately sets Worker-global isolation to false.
- Focused tests: 4 files / 90 tests passed.
- Full suite: 116 files / 4,090 tests passed. Existing converter PromiseRejectionHandledWarning remains in output.
- Build passed; generated SW version `1790997783`, vendor `59e2dc593998`.
- Root lint passed, including TypeScript and Docker Compose validation. Final probe-specific oxlint and diff checks passed.
- Independent review found no Critical/Important defect; it noted response URL/redirect metadata as a future compatibility case, without a demonstrated project failure.

## Browser procedure and evidence

`probe-isolation-worker-upgrade.mjs` starts an ephemeral local HTTP proxy over the existing port-5193 preview and launches an isolated Chromium profile. It does not install Playwright resource routes, so the browser's native HTTP cache remains available. The proxy streams upstream responses and records native spellchecker requests.

The old worker is the exact `2a675a7:public/sw.js` source with fixed old build/version strings and the current vendor hash. It warms native Word, Excel and PPT under a nonisolated host. The recorded old iframe cache entry has no COEP policy. The proxy then enables COOP/COEP headers and serves the newly built worker; actual landing/editor registration selects the new script URL.

Run:

```
node docs/evaluations/probe-isolation-worker-upgrade.mjs
ISOLATION_UPGRADE_ENTRY=editor node docs/evaluations/probe-isolation-worker-upgrade.mjs
```

The landing-entry result verifies all three upgraded editors complete document/full API loading, both main and iframe are isolated, and the correct worker controls them. Native PasteText writes a unique marker (Excel B2), then the native toolbar saves the document. The actual homepage file chooser reopens each downloaded DOCX/XLSX/PPTX and text snapshots match exactly. Finally, all three editors start offline, report `navigator.onLine === false`, and reject an uncached fetch.

The direct-editor entry result additionally records the first document's `entryEditor` readiness immediately after registration changes controller, before the subsequent three-editor sequence. This distinguishes first-entry readiness from merely checking a later reload. The earlier direct-entry control result did not check that initial document and is retained with this narrower scope.

Native spellchecker JS/WASM initially return 200, then 304 during warmup and after isolation is enabled. All final editor readiness checks succeed. This supports native HTTP-cache revalidation compatibility on this Chromium/proxy setup; it is not proof for every server cache policy or browser.

The initial save diagnostic is retained: empty unchanged documents disable their native Save button. It failed without claiming a pass. The harness now writes and verifies a native marker before waiting for Save, and observes pending download rejection if a preceding step fails.

## Limits and next gates

No real AI inference is performed by this probe; prior isolated model/tool evidence is separate. Exact text snapshots do not certify complete document styling or package equivalence. Physical Safari/iOS/Android/Firefox, redirected Worker modules, cold isolated startup, and production hosting remain separate gates. The broader local-AI objective remains in progress. Global acceleration configuration should be enabled only with the remaining startup/model/offline checks, preserving the user's simple IM flow.
