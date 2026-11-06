# Ops checklist — Cloudflare cache + WebMCP trial

These two levers sit **outside the repository**. Doing them is the highest
user-visible win left after the in-repo sweeps/matrix work; skipping them
leaves cold opens slow and WebMCP invisible.

## 1. Cloudflare Cache Rule for fonts and wasm

**Why:** Cold open still spends tens of seconds on large `/fonts/*` fetches when
the edge returns `cf-cache-status: DYNAMIC`. A Cache Rule that treats those
paths as cacheable (matching `_headers` / `immutable` intent) is what the v9
campaign measured as the path to ~10–20 s first open.

**Where:** Cloudflare dashboard → the `edit.chaxus.com` zone → Caching → Cache
Rules (or Rules → Cache Rules).

**Suggested match (adjust to the live zone UI):**

- URI Path starts with `/fonts/` **or** URI Path equals `/sdkjs/common/wasm/x2t/x2t.wasm.br`
- Then: Eligible for cache / respect origin `Cache-Control`

Do **not** cache HTML shells or deploy-coupled scripts (`/sw.js`,
`/sw-register.js`, `/open-local.js`, `/landing-prefetch.js`) — those stay
network-first via `_headers` and the SW.

**Verify:** open a cold private window, DevTools → Network → a `/fonts/0xx`
response should show `cf-cache-status: HIT` (or `EXPIRED` then `HIT`) on the
second load, not perpetual `DYNAMIC`.

## 2. Purge Cache after the font-licensing sweep

**Why:** `_headers` marks `/fonts/*` as year-long `immutable`. After proprietary
fonts were redirected to open-source slots, old URLs without a cache buster can
still serve the deleted proprietary bytes from the edge (observed: `/fonts/017`
returning old SimSun with multi-day `age`).

**Where:** Caching → Configuration → Purge Cache.

**What to purge:**

- Prefer **Custom Purge** of `/fonts/*` (and any known deleted slot URLs), or a
  one-time **Purge Everything** if custom prefixes are awkward.
- After purge, confirm a deleted proprietary slot 404s (or serves the
  substituted open-source file) even without a query buster.

Details and numbers: `docs/changelogs/2026-08-22-font-licensing.md`.

## 3. WebMCP Origin Trial token

**Status (2026-11-06):** registered for `https://edit.chaxus.com:443`, feature
`WebMCP`, expiry **2027-03-30**. Served from `public/_headers` (`/*`) and the
Docker twin `sws.toml`; `hosting-contract.test.ts` pins origin/feature/expiry.
Origin Trial tokens are public by design (every browser sees the header).

**Renew before 2027-03-30** at https://developer.chrome.com/origintrials — paste
the new token into both `_headers` and `sws.toml`, keep the contract test in sync.

**Verify after deploy to edit.chaxus.com:**

```bash
curl -sI https://edit.chaxus.com/editor | grep -i origin-trial
```

Then Chrome ≥ 149 → `/editor?new=docx` → console:

```js
Boolean(document.modelContext ?? navigator.modelContext)
```

## Done when

- [ ] Cache Rule live; second cold font fetch is HIT
- [ ] Font purge done; deleted proprietary slots no longer serve old bytes
- [x] WebMCP token in `_headers` / `sws.toml` (live after next production deploy)
- [ ] Production `curl -sI` shows `Origin-Trial` and console `modelContext` is truthy
