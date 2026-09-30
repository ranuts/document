import { expect, test } from './lib/l0';
import { buildDocx, buildPptx, toBase64 } from './lib/ooxml';
import { buildXlsx } from './actions/fixtures';
import { typeIntoDocument, waitForEditorReady } from './actions/editor';

/**
 * The unsaved-changes flag the embed API reports to its host
 * (document:dirty-changed, and `dirty` on document:state / document:saved).
 *
 * The part only the real editor can prove is the third edit: the SDK reports
 * "modified" on transitions only, so without moving its saved mark after a
 * host save (lib/onlyoffice/save-point.ts) an edit made after the first save
 * would never be reported and a host saving on tab switch or on a timer would
 * silently drop it.
 */

const FIXTURES = [
  { fileName: 'dirty.docx', build: () => buildDocx('dirty state') },
  { fileName: 'dirty.xlsx', build: () => buildXlsx() },
  { fileName: 'dirty.pptx', build: () => buildPptx('dirty state') },
];

test.describe('embed dirty state (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
    await page.evaluate(() => {
      const events: boolean[] = [];
      (window as any).__dirtyEvents = events;
      window.addEventListener('message', (event) => {
        if (event.data?.type === 'document:dirty-changed') events.push(Boolean(event.data.payload?.dirty));
      });
    });
  });

  for (const fixture of FIXTURES) {
    test(`${fixture.fileName}: an edit after a host save is reported again`, async ({ page }) => {
      const dirtyEvents = () => page.evaluate(() => [...((window as any).__dirtyEvents as boolean[])]);

      await page.evaluate(
        async ({ fileName, b64 }) => {
          await post('document:open-buffer', { fileName, base64: b64, readonly: false });
        },
        { fileName: fixture.fileName, b64: toBase64(fixture.build()) },
      );
      const { kind } = await waitForEditorReady(page);

      const opened = await page.evaluate(() => post('document:get-state', {}));
      expect(opened.dirty, 'a freshly opened document is clean').toBe(false);

      await typeIntoDocument(page, kind, 'first');
      await expect.poll(dirtyEvents, { timeout: 15_000 }).toEqual([true]);

      const saved = await page.evaluate(() => post('document:save', {}));
      expect(saved.size).toBeGreaterThan(0);
      expect(saved.dirty, 'the host holds every edit after the save').toBe(false);
      await expect.poll(dirtyEvents, { timeout: 15_000 }).toEqual([true, false]);

      await typeIntoDocument(page, kind, 'second');
      await expect.poll(dirtyEvents, { timeout: 15_000 }).toEqual([true, false, true]);

      const after = await page.evaluate(() => post('document:get-state', {}));
      expect(after.dirty).toBe(true);
    });
  }
});
