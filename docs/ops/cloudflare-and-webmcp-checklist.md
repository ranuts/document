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

**Why:** `lib/web-mcp.ts` is shipped and registers tools when
`document.modelContext` / `navigator.modelContext` exists. Without an Origin
Trial token in response headers, Chromium never exposes the API to visitors.

**Where:**

1. Register a token for `https://edit.chaxus.com` in Chrome’s Origin Trials
   console for the WebMCP / Model Context trial (name may change with the
   draft).
2. Add the token to Cloudflare → Rules → Transform Rules / Headers, or to
   `public/_headers` as:

   ```http
   /*
     Origin-Trial: <token>
   ```

   Prefer the edge injection if the token must not be committed; if it is
   safe to commit, `_headers` keeps Pages and Docker in sync (update
   `sws.toml` / hosting-contract tests the same way as other header changes).

**Verify:** Chromium with the trial → `/editor` → `document.modelContext` (or
`navigator.modelContext`) is defined; the seven tools from `lib/web-mcp.ts`
appear to the agent.

## Done when

- [ ] Cache Rule live; second cold font fetch is HIT
- [ ] Font purge done; deleted proprietary slots no longer serve old bytes
- [ ] WebMCP token live; modelContext present on production
