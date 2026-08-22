import { expect, test } from './lib/l0';
import { pixelDiff, settleEditor } from './lib/visual';

/**
 * The proprietary faces are gone from the catalog and the names they answered
 * to now resolve to open ones (bin/font-license-sweep.mjs). This is the check
 * that the substitution actually renders, in a real browser, with real text.
 *
 * It exists because the suite could not see the failure the first attempt
 * shipped (PR #170, reverted the same day): every glyph came out shifted --
 * `Hello` drawn as `Ebiil` -- and the visual round-trip spec stayed green,
 * because it compares a document against itself after a save and both sides
 * were rendered with the same wrong face.
 *
 * The invariant here has no such blind spot: a substituted family and the open
 * family that actually backs it point at the same catalog position, so the two
 * renderings of the same string must be pixel-identical. When the engine shapes
 * with one face and rasterises with another, only the substituted name is
 * affected and the two diverge.
 *
 * The probe text deliberately runs past U+00A0. Basic ASCII happens to share a
 * glyph order across most Latin faces, so `Hello` renders correctly even when
 * the wiring is broken -- that false negative is what let #170 reach the site.
 */
const LATIN = 'Hello ABC — Worläöü ÀÉÎ ¡¿ 0123';
const CJK = '你好，世界。中文测试 ABC';

const PAIRS = [
  { substituted: 'Arial', backedBy: 'Liberation Sans', text: LATIN },
  { substituted: 'Times New Roman', backedBy: 'Liberation Serif', text: LATIN },
  { substituted: 'Calibri', backedBy: 'Carlito', text: LATIN },
  { substituted: 'SimSun', backedBy: 'Noto Serif SC', text: CJK },
  { substituted: 'Microsoft YaHei', backedBy: 'Noto Sans SC', text: CJK },
] as const;

/**
 * The top of the page area, in a viewport this spec fixes below. It excludes
 * the toolbar -- which shows the family name, and so differs between the two
 * passes by construction -- and is deliberately taller than one line so a few
 * pixels of layout drift on another platform cannot crop the text out.
 */
const TEXT_LINE = { x: 170, y: 230, width: 980, height: 120 };

/**
 * Put `text` in `family` into an empty document and shoot the first line.
 *
 * The text is inserted through the plugin API rather than typed: page.keyboard
 * drops characters often enough to make a pixel comparison meaningless (a
 * dropped "Wo" is a 1.4% diff on its own, which is the same order as the
 * defect being looked for).
 */
async function renderIn(page: import('@playwright/test').Page, family: string, text: string): Promise<Buffer> {
  await page.evaluate(
    ({ name, body }) => {
      const findWin = (win: Window): Window | null => {
        try {
          if ((win as any).Asc?.editor?.asc_registerCallback) return win;
        } catch {
          /* cross-origin */
        }
        for (let i = 0; i < win.frames.length; i++) {
          const found = findWin(win.frames[i]);
          if (found) return found;
        }
        return null;
      };
      const frame = findWin(window);
      if (!frame) throw new Error('editor SDK instance not found');
      (frame.document.getElementById('area_id') as HTMLElement | null)?.focus();
      (frame as any).Asc.editor.pluginMethod_PasteHtml(
        `<p><span style="font-family:'${name}';font-size:14pt">${body}</span></p>`,
      );
    },
    { name: family, body: text },
  );
  await page.waitForTimeout(2500);
  // Just the first line of the page, not the whole frame: the toolbar shows
  // the family name, which differs between the two passes by construction.
  const shot = await page.screenshot({ clip: TEXT_LINE });
  // Leave the document empty for the next pass.
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(800);
  return shot;
}

test.describe('font substitution renders', () => {
  test.describe.configure({ timeout: 240_000 });

  for (const pair of PAIRS) {
    test(`${pair.substituted} renders exactly as ${pair.backedBy}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/editor?new=docx');
      await settleEditor(page);

      const substituted = await renderIn(page, pair.substituted, pair.text);
      const backing = await renderIn(page, pair.backedBy, pair.text);

      const diff = await pixelDiff(page, substituted, backing);
      console.log(
        `FONT ${pair.substituted}: differing=${diff.differingPct.toFixed(3)}% nonWhite=${diff.nonWhitePct.toFixed(2)}%`,
      );
      expect(diff.sizeSame).toBe(true);
      // Guard against a blank-vs-blank match: the text has to be on screen.
      expect(diff.nonWhitePct, 'nothing was rendered').toBeGreaterThan(0.5);
      expect(
        diff.differingPct,
        `"${pair.substituted}" and "${pair.backedBy}" share a catalog position, so they must draw the same pixels`,
      ).toBeLessThan(0.3);
    });
  }
});
