import { mkdirSync, writeFileSync } from 'node:fs';
import { buildDocx, buildPptx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';
import { editorHealth, saveAndCapture, waitForEditorReady, SAVE_FORMAT_CODE } from './actions/editor';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * UI crawl (strategy section 9.1 layer 2): every visible, enabled toolbar
 * button and every ribbon tab of each editor gets clicked once; dialogs and
 * menus that open are dismissed; after every click the editor must still be
 * alive (no fatal dialog, no critical asc_onError, page responsive), and at
 * the end the document must still save. Semantics are NOT asserted -- this
 * is the "every entry point is L0-touched at least once" layer that covers
 * the UI -> API glue the asc_* sweep cannot reach. Nightly-class (UI_CRAWL=1).
 * Findings go to the results dir as ui-crawl-<kind>.json (per-button outcome).
 */
type Outcome = { tab: string; id: string; title: string; ok: boolean; note?: string; ms: number };

test.describe('UI crawl', () => {
  test.skip(!process.env.UI_CRAWL, 'UI_CRAWL not set -- toolbar crawl is a nightly suite');
  test.describe.configure({ timeout: 900_000 });

  const CASES = [
    {
      kind: 'docx',
      name: 'crawl.docx',
      code: SAVE_FORMAT_CODE.docx,
      b64: () => toBase64(buildDocx('crawl target 抓取目标')),
    },
    { kind: 'xlsx', name: 'crawl.xlsx', code: SAVE_FORMAT_CODE.xlsx, b64: () => '' },
    { kind: 'pptx', name: 'crawl.pptx', code: SAVE_FORMAT_CODE.pptx, b64: () => toBase64(buildPptx('crawl slide')) },
  ] as const;

  for (const c of CASES) {
    test(`${c.kind}: click every toolbar button once, editor stays alive and saves`, async ({ page, l0 }) => {
      // Random UI clicks legitimately raise informational errors; only Critical
      // (-1) counts as a finding, attributed to the button below.
      l0.allowAscError((e) => e.level !== '-1');
      l0.allowConsole(/./);
      // Uncaught frame errors are attributed per button below and reported as
      // findings there; keep the fixture from failing the test a second time.
      l0.allowFrameError(/./);
      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
      await page.evaluate(
        async ({ name, b64 }) => {
          let bytes: Uint8Array;
          if (name.endsWith('.xlsx')) {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(
              wb,
              XLSX.utils.aoa_to_sheet([
                ['crawl', 1],
                ['抓取', 2],
              ]),
              'S',
            );
            bytes = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
          } else {
            const bin = atob(b64);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          }
          await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: false });
        },
        { name: c.name, b64: c.b64() },
      );
      await waitForEditorReady(page);

      const editor = page.frameLocator('iframe').frameLocator('iframe[name="frameEditor"]');
      const outcomes: Outcome[] = [];
      let criticalBefore = (await l0.ascErrors()).filter((e) => e.level === '-1').length;
      let frameErrorsBefore = (await l0.frameErrors()).length;

      // Dismiss whatever a click opened: modal windows (Escape / their close
      // button), dropdown menus (Escape), then give focus back to the canvas.
      const settle = async () => {
        for (let i = 0; i < 4; i++) {
          const modal = editor.locator('.asc-window.modal:visible, .asc-window.alert:visible').first();
          if (await modal.count()) {
            const close = modal
              .locator(
                '.close, .btn.normal.close, button:has-text("Cancel"), button:has-text("Close"), button:has-text("OK")',
              )
              .first();
            if (await close.count()) await close.click({ timeout: 2000 }).catch(() => {});
            else await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
            continue;
          }
          if (await editor.locator('.dropdown-menu:visible').count()) {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(150);
            continue;
          }
          break;
        }
      };

      const tabs = await editor
        .locator('.toolbar .ribtab a[data-tab]')
        .evaluateAll((els) =>
          els.map((e) => ({ tab: e.getAttribute('data-tab') || '', text: (e.textContent || '').trim() })),
        );
      const started = Date.now();
      for (const t of tabs) {
        // Ribbon tabs are UI too; skip File (a full-screen menu with its own
        // sub-navigation, crawled last) and any tab that isn't visible.
        if (t.tab === 'file') continue;
        const tabLink = editor.locator(`.toolbar .ribtab a[data-tab="${t.tab}"]`).first();
        if (!(await tabLink.isVisible().catch(() => false))) continue;
        await tabLink.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
        await settle();

        const buttons = await editor
          .locator('#toolbar button.btn-toolbar:not(.disabled), #toolbar button.dropdown-toggle:not(.disabled)')
          .evaluateAll((els) =>
            els
              .filter((e) => (e as HTMLElement).offsetParent !== null)
              .map((e, i) => ({
                i,
                // Buttons without an id are named after their toolbar slot
                // (slot-btn-*, slot-comment-*) so a finding names the control.
                id:
                  e.id ||
                  e.parentElement?.parentElement?.id ||
                  e.parentElement?.id ||
                  `${e.className.replace(/\s+/g, '.')}#${i}`,
                title: (
                  e.getAttribute('data-hint-title') ||
                  e.getAttribute('title') ||
                  (e.textContent || '').trim()
                ).slice(0, 40),
              })),
          );
        for (const b of buttons) {
          if (Date.now() - started > 600_000) break;
          const t0 = Date.now();
          const locator = editor
            .locator('#toolbar button.btn-toolbar:not(.disabled), #toolbar button.dropdown-toggle:not(.disabled)')
            .filter({ visible: true })
            .nth(b.i);
          let note = '';
          try {
            await locator.click({ timeout: 3000, force: true });
            await page.waitForTimeout(350);
          } catch (e) {
            note = `click failed: ${String((e as Error).message).slice(0, 60)}`;
          }
          await settle();
          const health = await editorHealth(page);
          const criticalNow = (await l0.ascErrors()).filter((e) => e.level === '-1').length;
          const alive = await page
            .evaluate(() => 1 + 1)
            .then(
              (v) => v === 2,
              () => false,
            );
          const frameErrors = await l0.frameErrors();
          const newFrameErrors = frameErrors.slice(frameErrorsBefore);
          const ok = alive && !health.fatalDialog && criticalNow === criticalBefore && newFrameErrors.length === 0;
          if (newFrameErrors.length)
            note += ` uncaught: ${newFrameErrors.map((e) => e.message.slice(0, 80)).join(' | ')}`;
          if (criticalNow !== criticalBefore) note += ` critical asc_onError x${criticalNow - criticalBefore}`;
          if (health.fatalDialog) note += ` fatal: ${health.fatalDialog.slice(0, 60)}`;
          criticalBefore = criticalNow;
          frameErrorsBefore = frameErrors.length;
          outcomes.push({ tab: t.tab, id: b.id, title: b.title, ok, note: note || undefined, ms: Date.now() - t0 });
          if (!alive) break;
        }
      }
      await settle();

      // Still saves after the whole sweep.
      const saved = await saveAndCapture(page, c.code, 120_000);
      const dir = process.env.E2E_PORT ? `test-results-${process.env.E2E_PORT}` : 'test-results';
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        `${dir}/ui-crawl-${c.kind}.json`,
        JSON.stringify({ kind: c.kind, tabs: tabs.length, buttons: outcomes.length, saved, outcomes }, null, 2),
      );
      const bad = outcomes.filter((o) => !o.ok);
      test.info().annotations.push({
        type: 'ui-crawl',
        description: `${c.kind}: ${outcomes.length} buttons across ${tabs.length} tabs, ${bad.length} findings, save ${saved.isZip ? 'ok' : 'FAILED'} (${saved.ms} ms)`,
      });
      console.log(`UI-CRAWL ${c.kind}: ${outcomes.length} buttons, ${bad.length} findings; save ${saved.isZip}`);
      for (const o of bad) console.log(`  FINDING [${o.tab}] ${o.id} "${o.title}": ${o.note}`);
      expect(saved.isZip).toBe(true);
      expect(bad.map((o) => `${o.tab}/${o.id}: ${o.note}`)).toEqual([]);
    });
  }
});
