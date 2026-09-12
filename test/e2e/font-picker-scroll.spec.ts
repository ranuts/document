import { expect, test } from './lib/l0';

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
 */
/** Opens the toolbar's font combo and scrolls its list to the very bottom. */
const scrollFontListToBottom = async () => {
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

  const frame = findFrame(window);
  if (!frame) return { error: 'no font combo in any frame' };
  const doc = frame.document;

  const menu = Array.from(doc.querySelectorAll<HTMLElement>('ul.dropdown-menu')).find((element) =>
    element.querySelector('a.font-item'),
  );
  if (!menu) return { error: 'no font menu' };

  const group = menu.parentElement;
  const toggle = group?.querySelector<HTMLElement>('button[data-toggle="dropdown"]');
  if (!toggle) return { error: 'no dropdown toggle' };
  toggle.click();
  // The menu paints its first screen of tiles as it opens; scrolling before
  // that has nothing to scroll.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // The list is virtualised: only the rows in view get a tile, and the crash
  // is in the ones at the end. perfect-scrollbar turns this into the same
  // onChange the wheel does.
  const rows = menu.querySelectorAll<HTMLElement>('a.font-item');
  menu.scrollTop = menu.scrollHeight;
  menu.dispatchEvent(new Event('scroll', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const last = rows[rows.length - 1];
  return {
    rows: rows.length,
    scrolled: menu.scrollTop,
    // getImage() returns a <canvas>, appended into the row's <a>.
    lastRowHasTile: Boolean(last?.querySelector('canvas')),
    tilesRendered: menu.querySelectorAll('a.font-item canvas').length,
  };
};

test.describe('the font picker (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });

  test('scrolling the list to the bottom draws the last font instead of throwing', async ({ page }) => {
    await page.goto('/editor?new=docx');
    // The font list is filled from the engine's catalog, which lands with the
    // rest of the editor boot.
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const visit = (win: Window): boolean => {
              try {
                if (win.document.querySelectorAll('a.font-item').length > 100) return true;
              } catch {
                /* cross-origin */
              }
              for (let i = 0; i < win.frames.length; i++) if (visit(win.frames[i])) return true;
              return false;
            };
            return visit(window);
          }),
        { timeout: 90_000 },
      )
      .toBe(true);

    const state = (await page.evaluate(scrollFontListToBottom)) as {
      error?: string;
      rows?: number;
      lastRowHasTile?: boolean;
      tilesRendered?: number;
    };

    expect(state.error).toBeUndefined();
    expect(state.rows, 'the whole catalog is in the list').toBeGreaterThan(100);
    expect(state.tilesRendered, 'the visible rows got their names drawn').toBeGreaterThan(0);
    expect(state.lastRowHasTile, 'the last font in the list has no name drawn').toBe(true);
  });
});
