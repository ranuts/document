import { expect, test } from './lib/l0';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  });
});

test('Word selection updates the composer through SDK events without idle reads', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await expect(page.locator('.agent-runtime-panel')).toBeVisible();
  await page.evaluate(() => {
    const win = window.__ooFrames.editor() as unknown as {
      Asc: {
        editor: {
          pluginMethod_InputText(text: string): void;
          asc_EditSelectAll(): void;
          pluginMethod_GetSelectedText: (...args: unknown[]) => string;
        };
      };
      contextReads?: number;
    };
    const api = win.Asc.editor;
    const original = api.pluginMethod_GetSelectedText;
    win.contextReads = 0;
    api.pluginMethod_GetSelectedText = function (...args: unknown[]) {
      win.contextReads!++;
      return original.apply(this, args);
    };
    api.pluginMethod_InputText('Event-driven selection');
    api.asc_EditSelectAll();
  });
  await expect(page.locator('.agent-quoted-text')).toHaveText('Event-driven selection');
  // Let notification bursts settle, then observe longer than the former interval.
  await page.waitForTimeout(100);
  const reads = () =>
    page.evaluate(() => (window.__ooFrames.editor() as unknown as { contextReads: number }).contextReads);
  const before = await reads();
  await page.waitForTimeout(1200);
  expect(await reads()).toBe(before);
});

test('spreadsheet cell navigation updates context without reopening the panel', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/editor?new=xlsx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.evaluate(() => {
    const win = window.__ooFrames.editor() as unknown as { Asc: { editor: { asc_findCell(address: string): void } } };
    win.Asc.editor.asc_findCell('B2');
  });
  await expect(page.locator('.agent-quote-context summary')).toContainText('B2');
  await page.evaluate(() => {
    const win = window.__ooFrames.editor() as unknown as {
      Asc: { editor: { asc_renameWorksheet(name: string): void } };
    };
    win.Asc.editor.asc_renameWorksheet('Updated sheet');
  });
  await expect(page.locator('.agent-quote-context summary')).toContainText('Updated sheet');
  // Keep the same selection: a completed history action must update its contents.
  await page.evaluate(() => {
    const win = window.__ooFrames.editor() as unknown as {
      Asc: {
        editor: {
          wb: {
            getWorksheet(): {
              model: { getRange3(r1: number, c1: number, r2: number, c2: number): { setValue(value: string): void } };
            };
          };
        };
      };
      AscCommon: { History: { Create_NewPoint(): void; StartTransaction(): void; EndTransaction(): void } };
    };
    const history = win.AscCommon.History;
    history.Create_NewPoint();
    history.StartTransaction();
    win.Asc.editor.wb.getWorksheet().model.getRange3(1, 1, 1, 1).setValue('Updated B2');
    history.EndTransaction();
  });
  await expect(page.locator('.agent-quoted-text')).toHaveText('Updated B2');
});

test('native sidebar follows compact media changes while the panel stays closed', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  const frame = page.frameLocator('iframe[name="frameEditor"]');
  await expect(frame.locator('#right-menu .agent-sidebar-entry')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 850 });
  await expect(frame.locator('#left-menu .agent-sidebar-entry')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(frame.locator('#right-menu .agent-sidebar-entry')).toBeVisible();
  await expect(frame.locator('.agent-sidebar-entry')).toHaveCount(1);
});
