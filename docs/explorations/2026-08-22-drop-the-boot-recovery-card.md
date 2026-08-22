# Dropping the boot-time recovery card (2026-08-22)

A user opened a new spreadsheet and got a card in the bottom-right corner
offering to restore `New_Document.docx` -- a different document, from two hours
earlier -- with its primary button clipped off at the card's edge. Their
verdict: "这个提示完全没有必要的吧."

They were right, and the layout bug was the smaller half of it.

## Why the card could not be right where it stood

`/editor` never opens empty. A bare visit is redirected to the landing page
(see the hero orchestration in `index.ts`), so every boot of the editor is a
boot with a document arriving: `?new=`, `?file=`, `?src=`, `?open=local` or
`?doc=`. The card was shown 1.5 s after load, excluding only the document named
by `?doc=`, which means it could only ever arrive on top of a document the user
had just opened, to talk about a different one.

There is no timing or copy fix for that. The offer had no quiet moment to
appear in, because the editor has no quiet moment.

The clipping came from the same place: three actions (a primary button, a text
button and a link) in one 380 px card, with copy long enough -- "Pick up where
I left off" -- to overflow the row. It was fixable, but fixing it would only
have made a well-laid-out interruption.

## What replaces it

Nothing new; two surfaces that already existed and are not interruptions:

- the landing page's "continue last time" line (`public/history-recent.js`),
  which reads one metadata row out of IndexedDB without shipping the app
  bundle, and is the surface the common return visit actually lands on;
- `/history`, linked from the homepage, where every stored document is listed
  with its age, its expiry and an Open link.

The recovery _feature_ is untouched: `restoreDocument` still puts the newest
snapshot back through the ordinary open path, and `?doc=<id>` still restores
on reload. Only the unsolicited announcement is gone.

## What was removed

- `offerRecovery` / `buildBar` / `dismissRecoveryBar` and the boot hook in
  `index.ts`; `recovery.ts` keeps `restoreDocument` and `formatRelativeTime`.
- `getRecoverableDoc` and `dismissRecovery` in the store, plus the
  `dismissedAt` field they maintained -- with no offer, there is nothing to
  turn down and nothing to remember turning down.
- `.recovery-bar*` in `styles/base.css` (116 lines) and the five `recovery*`
  strings across all eight locales.

## The same reasoning removes one more notice

Reviewing the rest of the feature for uninvited interruptions found one:
opening a document in a second tab raised a warning toast saying another tab
was editing it. The user had done nothing wrong, had nothing to do about it,
and which tab holds the write lock is our bookkeeping. The lock stays -- two
tabs writing snapshots for one document would interleave two divergent
histories -- but it is now silent.

### Where the line is

Not every message is an interruption, so it is worth writing down which ones
survived and why:

| Message                            | Kept?       | Why                                                                                                          |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| Boot recovery card                 | **removed** | Arrives unasked, on top of a document the user just opened, about a different one                            |
| "Another tab is editing this"      | **removed** | Internal bookkeeping; nothing for the user to do                                                             |
| "Autosave stopped: out of storage" | kept        | The user is about to believe there is a recovery point when there is none, and it tells them to export       |
| "Saved to <file>"                  | kept        | The answer to an action the user just took (Ctrl+S), and the only feedback that a silent write-back happened |
| Open/convert failures              | kept        | The document did not open; nothing else says so                                                              |

The rule that separates them: **an answer to something the user did is not an
interruption; an announcement about something we did is.** The two removed
messages are announcements. The three kept ones are answers, or warnings the
user must act on to avoid losing work.

## Reverse verification

`test/e2e/autosave-recovery.spec.ts` now asserts the opposite of what it used
to: after storing an unsaved snapshot, opening `/editor?new=docx` must show no
`#recovery-bar`, and the work is reached through `/history` instead. Restoring
the removed source (`git checkout HEAD -- index.ts lib/history/*.ts …`) and
re-running that spec fails exactly there:

```
> 126 |     expect(await page.locator('#recovery-bar').count()).toBe(0);
      Expected: 0
      Received: 1
```

With the removal back in place the spec passes, as does `history-page.spec.ts`
(14 tests) and the unit suite.

## Unrelated, found on the way

The same report included garbled text and a fatal "An error occurred during the
work with the document" -- Chinese rendering as tofu, and "Click to add title"
rendering as "Qjgbc rgjc" (glyph ids off by two). That is the font substitution
sweep, not this feature: the branch under test still carried `6dd918f`, which
`main` had already reverted in `0d46030` + `aabd740`. Rebasing onto `main`
clears it. The substitution work continues on its own branch; see
`docs/explorations/2026-08-22-font-licensing-and-multilingual-fallback.md`.
