# Open-time NeedStyles clamp (font-load guard 15c) — 2026-11-22

## Why

`CheckFontNeeds` builds `new AscFonts.CFont(name)` from name-only
`Document_Get_AllFontNames`, and the CFont ctor turns a missing style into
**NeedStyles = 15** (every face). A Regular-only Latin one-pager still queued
Italic/Bold/BI files for every family that had them. Style-aware data already
existed in `Document_CreateFontMap` (Style 0..3) but the open path never used it.

## What we did

- `lib/onlyoffice/guards/font-loading.ts`: wrap `DrawingDocument.CheckFontNeeds`
  (primary) and `LoadDocumentFonts` (belt). Read
  `Document_CreateFontMap()`, map Style → face bits (0→1, 1→4, 2→2, 3→8,
  always `| 1`), rewrite `LogicDocument.Fonts`. Families **in** the map are
  narrowed to `known | Regular | Italic` (Italic covers chrome / placeholders
  that never appear in CreateFontMap). Families only on the open list
  (style-sheet / theme extras) **keep the vendor NeedStyles** (usually 15) —
  clamping those to Regular-only caused `asc_onError -25`. Dropping Italic on
  mapped families also surfaced tip-level `-25` on first paint.
  `LoadDocumentFonts2` (paste) does not go through CheckFontNeeds, so it stays
  unclamped. The iframe poll waits for the CheckFontNeeds hook on word/slide.
- `fontSources()` in `x2t-worker.ts` now honors the same bits so conversion does
  not re-pull every face after the open clamp.
- Pure helpers + bit filtering pinned in `test/unit/font-need-styles.test.ts`;
  live clamp in `embed-regression` "open-time NeedStyles is clamped…"
  (expects Arial NeedStyles === 7 for a Regular+Bold sample).

## Reverse verification

Temporarily short-circuit `rewriteFontsNeedStyles` so it returns without writing:
the new E2E fails with Arial NeedStyles still **15** (expected **7**). Restoring
the rewrite turns it green again. Unit tests for `fontSources(NeedStyles=1)` fail
if the bit check in `x2t-worker.ts` is removed.

Keeping Italic on mapped families also removed the tip-level `asc_onError -25`
that appeared when the clamp was Regular|Bold only (5).

## Out of scope

Cell editor (no useful CreateFontMap on open). Changing vendor x2t / rebuilding
wasm. Interactive `LoadFont` still requests 15 when the user first applies a
new face — that is intentional.
