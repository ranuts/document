import { expect, test } from './lib/l0';
import { settleEditor } from './lib/visual';

/**
 * Scrolling the font list to the bottom must not end the editing session.
 *
 * The dropdown does not draw font names as text. Each row is a tile cut out of
 * a sprite, indexed by the font's position in the catalog:
 *
 *     s = Math.floor(store.at(n).get('imgidx') / r)
 *     spriteThumbs.getImage(s)  ->  new Uint8ClampedArray(data.buffer, s * a, a)
 *
 * A catalog longer than the sprite does not degrade, it throws
 * `RangeError: Invalid typed array length: 33600` out of that constructor --
 * and then again on every subsequent scroll, so the document can no longer be
 * edited. That is GitHub #218, and it was ours: the font licensing sweep
 * appended nine families and left the vendor's 193-tile sprites alone.
 *
 * `test/unit/font-catalog-licensing.test.ts` pins the invariant in the data.
 * This is the user's path through it: open the list, scroll to the end, and
 * require that the last row actually got its name drawn. The L0 fixture fails
 * the case on the uncaught RangeError by itself; the assertion below is what
 * says the row is *readable* rather than merely not-crashing.
 *
 * Everything here polls rather than sleeps. The list is filled from the
 * engine's catalog and virtualised as it scrolls, so every step lands at a
 * moment a loaded CI runner picks for itself.
 */

type MenuState = { found: boolean; rows: number; tiles: number; lastHasTile: boolean; open: boolean };

/**
 * One self-contained function, because `page.evaluate` ships only the function
 * it is given -- a helper from module scope is not there when it runs.
 *
 * `read` reports; `open` clicks the combo's toggle; `scroll` sends the list to
 * the end, which perfect-scrollbar turns into the same onChange the wheel does.
 */
const driveFontMenu = (action: 'read' | 'open' | 'scroll'): MenuState => {
  const findFrame = (win: Window): Window | null => {
    try {
      if (win.document.querySelector('a.font-item')) return win;
    } catch {
      /* cross-origin */
    }
    for (let i = 0; i < win.frames.length; i++) {
      const found = findFrame(win.frames[i]);
      if (found) return found;
    }
    return null;
  };

  const empty: MenuState = { found: false, rows: 0, tiles: 0, lastHasTile: false, open: false };
  const frame = findFrame(window);
  if (!frame) return empty;
  const menu = Array.from(frame.document.querySelectorAll<HTMLElement>('ul.dropdown-menu')).find((element) =>
    element.querySelector('a.font-item'),
  );
  if (!menu) return empty;

  if (action === 'open') {
    const toggle = menu.parentElement?.querySelector<HTMLElement>('button[data-toggle="dropdown"]');
    if (toggle && !menu.parentElement?.classList.contains('open')) toggle.click();
  } else if (action === 'scroll') {
    menu.scrollTop = menu.scrollHeight;
    menu.dispatchEvent(new Event('scroll', { bubbles: true }));
  }

  const rows = menu.querySelectorAll<HTMLElement>('a.font-item');
  const last = rows[rows.length - 1];
  return {
    found: true,
    rows: rows.length,
    // getImage() returns a <canvas>, appended into the row's <a>.
    tiles: menu.querySelectorAll('a.font-item canvas').length,
    lastHasTile: Boolean(last?.querySelector('canvas')),
    open: Boolean(menu.parentElement?.classList.contains('open')),
  };
};

test.describe('the font picker (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });

  test('scrolling the list to the bottom draws the last font instead of throwing', async ({ page }) => {
    await page.goto('/editor?new=docx');
    await settleEditor(page);

    // The list is filled from the engine's catalog, which lands with the rest
    // of the editor boot rather than with the toolbar.
    await expect
      .poll(async () => (await page.evaluate(driveFontMenu, 'read' as const)).rows, { timeout: 90_000 })
      .toBeGreaterThan(100);

    // Opening is itself retried: on a loaded runner the toolbar can still be
    // settling when the first click lands.
    await expect
      .poll(async () => (await page.evaluate(driveFontMenu, 'open' as const)).open, { timeout: 60_000 })
      .toBe(true);
    await expect
      .poll(async () => (await page.evaluate(driveFontMenu, 'read' as const)).tiles, { timeout: 60_000 })
      .toBeGreaterThan(0);

    await expect
      .poll(async () => (await page.evaluate(driveFontMenu, 'scroll' as const)).lastHasTile, { timeout: 60_000 })
      .toBe(true);
  });
});
