# Preserve provider caches during application upgrades

While auditing isolation-header migration, activation cleanup was found to delete every CacheStorage cache except the current application caches and retained vendor caches. Cache API is also the wllama fallback when OPFS is unavailable. Its `local-ai-wllama-models-v1` cache was outside the application names and therefore eligible for deletion on each worker activation. This could defeat offline reuse despite successful model caching.

Activation now retires only known application core/runtime namespaces and historical versioned single-cache names (timestamp, dev timestamp, and v versions). Unrelated provider and plugin caches remain untouched, including future `document-editor-models` names. Existing current-cache exclusions and safeguards for vendor caches used by open windows remain unchanged.

## Verification

- A regression invoking the actual shipped worker activation failed before the fix because the model cache disappeared. After the fix, model contents and unrelated caches survive while five historical retired application cache names are removed.
- Focused coverage: 3 files, 64 tests passed. Full suite: 115 files, 4083 tests passed. Build and root lint passed; existing converter PromiseRejectionHandledWarning messages remain.
- Read-only code review found no Important/Critical issues and independently ran all 54 sw-update tests.
- Actual isolated Chromium first installed the prior worker source, then seeded four provider/plugin marker caches and two retired application caches. Registration update installed the current built worker. VERSION messages confirmed `ownership-old-control` → `1790995880` before entering offline mode. Retired caches were removed; all protected byte arrays, including NUL and Chinese UTF-8, stayed exact. An uncached fetch failed and navigator.onLine was false. No page errors were observed.

The first runtime attempt entered offline too early: its async waitForFunction predicates did not prove activation, and the observed controller version remained old. It is retained as a diagnostic. The final probe explicitly awaits native VERSION replies and cache removal before going offline; this prevents a false upgrade pass.

Reports record exact probe hashes and old/new worker source hashes. To prepare the archived runtime probe's old source from the repository, run `git show ba1b899:public/sw.js > .scratch/ai-csp/sw-before-cache-ownership.js` after ensuring that directory exists. Run the final probe against the existing preview on port 5193 after building.

Marker payloads verify real CacheStorage preservation, not full model-weight loading. The isolation-header upgrade itself remains unverified and disabled in production configuration. Next work must verify cached iframe/worker response headers and cold offline isolation before enabling the four-thread acceleration. The wider goal remains open.
