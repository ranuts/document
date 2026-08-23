/**
 * Guard 11: a missing translation must not become a document error.
 *
 * The vendor's locale files are incomplete against `en.json` -- all 44 of them,
 * from a couple of keys to a few thousand. Most gaps are invisible, because the
 * component keeps whatever default its own source defines. But some strings
 * exist only in the locale file, so a gap leaves the property `undefined`, and
 * the tooltip setter does not check:
 *
 *     updateHint: function (t) { ... "string" == typeof t ? t : t[0] ... }
 *
 * `undefined[0]` throws inside the view layer, the app catches it as a document
 * error, and the user gets the modal "An error occurred while working with the
 * document. Use the 'Download as' option to save a backup copy" -- on a blank
 * document, before they have typed anything. Korean hit precisely this:
 * `DE.Views.Statusbar.tipMultiplePages` is in en.json, absent from ko.json, and
 * the status bar reads it while rendering.
 *
 * bin/locale-fill.mjs closes the gaps for the languages this site is
 * translated into, which is the real fix and the one users see (they get an
 * English tooltip rather than a broken editor). This guard covers the rest: the
 * editor accepts any of the vendor's 45 locales through `?locale=`, and a
 * vendor upgrade can introduce a new gap in any of them at any time. A tooltip
 * that never appears is a blemish; a modal error on an empty document is not.
 */
type HintTarget = { updateHint?: (hint?: unknown, ...rest: unknown[]) => unknown; __hintGuarded?: boolean };

/** Component prototypes that own an updateHint reading `hint[0]`. */
function hintOwners(win: Window): HintTarget[] {
  const ui = (win as unknown as { Common?: { UI?: Record<string, { prototype?: HintTarget }> } }).Common?.UI;
  if (!ui) return [];
  return Object.values(ui)
    .map((component) => component?.prototype)
    .filter((proto): proto is HintTarget => Boolean(proto && typeof proto.updateHint === 'function'));
}

export function installHintFallbackGuard(win: Window): boolean {
  const frame = win as Window & { __ooHintGuarded?: boolean };
  const owners = hintOwners(win);
  // Common.UI lands during the editor's boot; report "not yet" so the caller
  // keeps re-applying until the components exist.
  if (!owners.length) return Boolean(frame.__ooHintGuarded);

  for (const proto of owners) {
    if (proto.__hintGuarded) continue;
    const original = proto.updateHint!;
    proto.updateHint = function (this: unknown, hint?: unknown, ...rest: unknown[]) {
      // Keep whatever tooltip is already there rather than throwing. An empty
      // array would clear it; undefined is what a missing translation gives.
      if (hint === undefined || hint === null) return undefined;
      return original.call(this, hint, ...rest);
    };
    proto.__hintGuarded = true;
  }
  frame.__ooHintGuarded = true;
  return true;
}
