# Health: nightly sweeps + matrix blanks + ops checklist

## Why

A project review found three cheap lies and two ops blockers:

1. Docs claimed `API_SWEEP` / `SHORTCUT_SWEEP` / `MONKEY` ran nightly; only UI
   crawl + slow-net were wired.
2. Test-matrix "easy blanks" (pptx/pdf bare save default, ODF readonly +
   idempotence) were still open; pdf env-retry does not apply (no convertToBin).
3. CLAUDE still taught `setConverterCallbacks` and "16 guards" after the code
   moved on; "freeze for a v9 release announcement" no longer matches how tags
   ship.
4. CF Cache Rule / Purge and the WebMCP Origin Trial token remain outside the
   repo — checklist at `docs/ops/cloudflare-and-webmcp-checklist.md`.

## What landed in-repo

- `.github/workflows/nightly-corpus.yml` `sweeps` job + `workflow-contract` pin
- `embed-save-default` covers pptx + pdf; `odf-formats` covers readonly export
  and save→reopen→save
- Doc scrub + ops checklist

## Still deferred (separate cycles)

- Document-aware font preload (after Cache Rule is live)
- Split `lib/agent-plugin/ui/panel.ts` (~3k lines)
- Chart / OLE fixed fixtures; journey action library
