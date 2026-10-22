import { expect, test } from './lib/l0';
import { textGeometry } from './lib/layout-geometry';

for (const variant of [
  { width: 1280, locale: 'en', coarse: false },
  { width: 320, locale: 'pt', coarse: true },
]) {
  test.describe(`${variant.width}px ${variant.locale} single return`, () => {
    test.use({ viewport: { width: variant.width, height: 900 }, hasTouch: variant.coarse });
    test('one shell return retains the nested dirty guard and restores the Chat draft', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('document-assistant-enabled', 'true'));
      await page.goto(`/editor?new=docx&locale=${variant.locale}`);
      await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
      await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
      const panel = page.locator('.agent-runtime-panel');
      const composer = panel.locator('.cui-input');
      await composer.fill('A draft to preserve');
      await composer.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(2, 7));
      await panel.locator('.agent-workspace-toggle').click();
      await expect(panel.locator('.agent-panel-title')).toBeVisible();
      await expect(panel.locator('[data-action=back]:visible')).toHaveCount(0);
      await panel.locator('[data-action=import]').click();
      const back = panel.locator('.agent-panel-header [data-action=back]');
      await expect(back).toBeVisible();
      const caption = back.locator('span');
      await expect(caption).toHaveText(variant.locale === 'pt' ? 'Artefatos' : 'Artifacts');
      await expect(back).toHaveAccessibleName(new RegExp(await caption.innerText(), 'i'));
      const readable = await caption.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect().width <= el.getBoundingClientRect().width + 1;
      });
      expect(readable, 'the parent destination must remain readable in the actual header').toBe(true);
      await expect(panel.locator('.agent-panel-title')).toBeHidden();
      await expect(panel.locator('.agent-artifacts .agent-view-back')).toHaveCount(0);
      await expect(panel.locator('.agent-artifacts > .agent-view-header')).toBeHidden();
      const title = panel.locator('.agent-artifact-import input');
      await title.fill('Unsaved import');
      const peerHeader = panel.locator('.agent-workspace-toggle');
      await peerHeader.focus();
      await page.keyboard.press('Escape');
      const discard = panel.locator('.agent-artifact-status [data-action=discardChanges]');
      await expect(discard).toBeVisible();
      await expect(title).toHaveValue('Unsaved import');
      await title.press('Escape');
      await expect(discard).toBeVisible();
      await expect(panel).toHaveAttribute('data-view', 'artifacts');
      await panel.locator('.agent-artifact-status [data-action=cancel]').click();
      await expect(peerHeader).toBeFocused();
      await expect(title).toHaveValue('Unsaved import');
      await back.click();
      await panel.locator('.agent-artifact-status [data-action=cancel]').click();
      await expect(back).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(panel.locator('.agent-artifact-status [data-action=cancel]')).toBeFocused();
      await discard.click();
      await expect(panel.locator('[data-action=import]')).toBeVisible();
      await expect(back).toHaveCount(0);
      await expect(panel.locator('.agent-artifacts h2')).toBeFocused();
      await peerHeader.focus();
      await page.keyboard.press('Escape');
      await expect(panel).toHaveAttribute('data-view', 'chat');
      await expect(composer).toHaveValue('A draft to preserve');
      // Escape's final destination retains the existing trigger-focus contract.
      await expect(panel.locator('.agent-workspace-toggle')).toBeFocused();
      expect(await composer.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([
        2, 7,
      ]);
    });

    test('artifact command glyphs start on the content rail across wrapped rows', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('document-assistant-enabled', 'true'));
      await page.goto(`/editor?new=docx&locale=${variant.locale}`);
      await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
      await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
      const panel = page.locator('.agent-runtime-panel');
      await panel.locator('.agent-workspace-toggle').click();
      await panel.locator('[data-action=import]').click();
      await panel.locator('.agent-artifact-import input').fill('Command rails');
      await panel
        .locator('.agent-artifact-import textarea')
        .fill(
          JSON.stringify({ schemaVersion: 1, payload: { kind: 'text', text: '# Command rails\n\nA saved result.' } }),
        );
      await panel.locator('[data-action=saveNew]').click();
      const workbench = panel.locator('.agent-artifact-workbench');
      await expect(workbench).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: theme });
        expect((await textGeometry(workbench.locator('[data-action=refine]'))).textLeft).toBeCloseTo(16, 1);
        // Select each wrapped row's first command using actual box tops, then
        // measure its visible text independently of the padded hit frame.
        const firstCommands = await workbench
          .locator('.agent-artifact-actions > :is(button, details)')
          .evaluateAll((buttons) =>
            buttons
              .filter((button, index) => {
                if (!index) return true;
                return button.getBoundingClientRect().top >= buttons[index - 1].getBoundingClientRect().bottom - 1;
              })
              .map((button) => (button.tagName === 'DETAILS' ? 'export' : button.getAttribute('data-action'))),
          );
        for (const action of firstCommands) {
          if (action === 'export') {
            const summary = workbench.locator('.agent-artifact-actions > details > summary');
            const markerStart = await summary.evaluate((el) => {
              const panel = el.closest('.agent-panel')!;
              return (
                el.getBoundingClientRect().left +
                parseFloat(getComputedStyle(el).paddingLeft) -
                panel.getBoundingClientRect().left -
                parseFloat(getComputedStyle(panel).borderLeftWidth)
              );
            });
            expect(markerStart).toBeCloseTo(16, 1);
            expect((await textGeometry(summary)).textLeft).toBeGreaterThan(markerStart);
          } else {
            expect(
              (await textGeometry(workbench.locator(`.agent-artifact-actions > [data-action="${action}"]`))).textLeft,
            ).toBeCloseTo(16, 1);
          }
        }
        const separatorStart = await workbench.locator('.agent-artifact-actions').evaluate((el) => {
          const panel = el.closest('.agent-panel')!;
          return (
            el.getBoundingClientRect().left +
            parseFloat(getComputedStyle(el, '::after').left) -
            panel.getBoundingClientRect().left -
            parseFloat(getComputedStyle(panel).borderLeftWidth)
          );
        });
        expect(separatorStart).toBeCloseTo(16, 1);
        expect(await panel.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
      }
      // Keep a real IndexedDB writer ahead of Save so the artifact owner is
      // genuinely busy; header-focused Escape must consume that guarded return.
      await workbench.locator('[data-action=edit]').click();
      await workbench.locator('[data-artifact-source]').fill('A pending saved version');
      await page.evaluate(async () => {
        const opening = indexedDB.open('document-ai-artifacts', 1);
        const db = await new Promise<IDBDatabase>((resolve) => {
          opening.onsuccess = () => resolve(opening.result);
        });
        const transaction = db.transaction(['artifacts', 'summaries'], 'readwrite');
        let held = true;
        const pump = () => {
          if (!held) return;
          const request = transaction.objectStore('artifacts').get('__navigation_lock__');
          request.onsuccess = pump;
        };
        pump();
        const fixture = window as Window & { releaseArtifactNavigationLock?: () => void };
        fixture.releaseArtifactNavigationLock = () => {
          held = false;
          delete fixture.releaseArtifactNavigationLock;
        };
        transaction.oncomplete = () => db.close();
      });
      await workbench.locator('[data-action=saveVersion]').click();
      const back = panel.locator('.agent-panel-header [data-action=back]');
      await expect(back).toBeDisabled();
      const peerHeader = panel.locator('.agent-workspace-toggle');
      await peerHeader.focus();
      await page.keyboard.press('Escape');
      await expect(panel).toHaveAttribute('data-view', 'artifacts');
      await expect(back).toBeDisabled();
      await expect(workbench.locator('[data-artifact-source]')).toHaveValue('A pending saved version');
      await page.evaluate(() =>
        (window as Window & { releaseArtifactNavigationLock?: () => void }).releaseArtifactNavigationLock?.(),
      );
      await expect(back).toBeEnabled();
      await peerHeader.focus();
      await page.keyboard.press('Escape');
      await expect(panel.locator('[data-action=import]')).toBeVisible();
      await expect(panel.locator('.agent-artifacts h2')).toBeFocused();
    });
  });
}
