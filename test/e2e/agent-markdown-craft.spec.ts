import { expect, test } from './lib/l0';
import { installConversationFixture } from './lib/conversation-fixture';

const code =
  '\tconst release: string = "ready";\n\n  // Preserve tabs, blank lines and the final newline.\n  const endpoint = "https://example.com/releases?environment=production&include=metrics,owners,dependencies,release-notes,reviewers";\n';
const source = [
  '| Stage | Owner | Region | Requests | p95 | Notes |',
  '| :--- | :---: | :--- | ---: | ---: | :--- |',
  '| Production | Platform engineering | Europe | 24,096 | 128 ms | Review before publishing |',
  '| Preview | Product engineering | America | 1,248 | 42 ms | Keep a plain code fallback |',
  '',
  '```typescript',
  code,
  '```',
  '',
  '```unknown-example',
  '<script>window.__markdownMustNotRun = true</script>',
  '```',
  '',
  '![remote](https://example.com/private-image.png) [unsafe](javascript:alert(1))',
].join('\n');
for (const variant of [
  { width: 320, locale: 'pt', theme: 'light', copied: 'Copiado', copy: 'Copiar', failed: 'Falha ao copiar' },
  { width: 360, locale: 'en', theme: 'dark', copied: 'Copied', copy: 'Copy', failed: 'Could not copy' },
] as const) {
  test.describe(`${variant.width}px ${variant.locale} Markdown`, () => {
    test.use({ viewport: { width: variant.width, height: 900 }, hasTouch: true, colorScheme: variant.theme });
    test('shares aligned tables and exact, highlighted code copy between Chat and Artifacts', async ({ page }) => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.addInitScript(installConversationFixture);
      await page.addInitScript(
        ({ source, theme }) => {
          localStorage.setItem('ran-theme', theme);
          const fetch = window.fetch.bind(window);
          window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const body = init?.body ? JSON.parse(String(init.body)) : {};
            if (!url.endsWith('/api/chat') || body.format?.properties?.task) return fetch(input, init);
            const encoder = new TextEncoder();
            return new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(
                    encoder.encode(JSON.stringify({ done: false, message: { content: source } }) + '\n'),
                  );
                  controller.enqueue(encoder.encode(JSON.stringify({ done: true, message: { content: '' } }) + '\n'));
                  controller.close();
                },
              }),
              { headers: { 'Content-Type': 'application/x-ndjson' } },
            );
          };
        },
        { source, theme: variant.theme },
      );
      await page.goto(`/editor?new=docx&locale=${variant.locale}`);
      await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
      await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
      const panel = page.locator('.agent-runtime-panel');
      await panel.locator('.agent-panel-settings-toggle').click();
      await panel.locator('.agent-panel-endpoint-connect').click();
      await panel.locator('.agent-chat-toggle').click();
      await panel.locator('.cui-input').fill('Show a release table and TypeScript example.');
      await panel.locator('.cui-send').click();
      await expect(panel.locator('.cui-msg-agent .cui-code')).toHaveCount(2);
      await expect(panel.locator('.cui-stop')).toBeHidden();
      const answer = panel.locator('.cui-msg-agent');
      for (const host of [answer.locator('.cui-bubble'), panel.locator('.agent-artifact-reader')]) {
        if (!(await host.count())) await answer.locator('.cui-save').click();
        await expect(host).toBeVisible();
        const table = host.locator('.cui-table');
        await expect(table).toHaveAttribute('role', 'region');
        await expect(table).toHaveAttribute('aria-label', variant.locale === 'pt' ? 'Tabela' : 'Table');
        await expect(table.locator('td').first()).toHaveCSS('font-weight', '400');
        expect(
          await table.locator('th').evaluateAll((cells) => cells.map((cell) => getComputedStyle(cell).textAlign)),
        ).toEqual(['left', 'center', 'left', 'right', 'right', 'left']);
        await table.scrollIntoViewIfNeeded();
        await table.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => table.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
        expect(await panel.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
        const frame = host.locator('.cui-code').first();
        await expect(frame.locator('.cui-code-language')).toHaveText('TypeScript');
        await expect.poll(() => frame.locator('.cui-code-token').count()).toBeGreaterThan(0);
        const pre = frame.locator('pre');
        expect(await pre.locator('code').textContent()).toBe(code);
        await pre.scrollIntoViewIfNeeded();
        await pre.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => pre.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
        const copy = frame.locator('.cui-code-copy');
        await copy.click();
        await expect(copy).toHaveText(variant.copied);
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
        expect(await copy.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        const readable = await copy.evaluate((el) => {
          const label = el.querySelector('.cui-code-copy-label')!;
          const range = document.createRange();
          range.selectNodeContents(label);
          return range.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1;
        });
        expect(readable).toBe(true);
        const fallback = host.locator('.cui-code').nth(1);
        await expect(fallback.locator('.cui-code-language')).toHaveText('unknown-example');
        await expect(fallback.locator('.cui-code-token')).toHaveCount(0);
        await expect(fallback.locator('code')).toHaveText('<script>window.__markdownMustNotRun = true</script>');
        await expect(host.locator('script,img,a[href^="javascript:"]')).toHaveCount(0);
      }
      const session = await page.context().newCDPSession(page);
      const { targetInfo } = await session.send('Target.getTargetInfo');
      await session.send('Browser.setPermission', {
        permission: { name: 'clipboard-write' },
        browserContextId: targetInfo.browserContextId,
        setting: 'denied',
        origin: new URL(page.url()).origin,
      });
      const denied = panel.locator('.agent-artifact-reader .cui-code-copy').first();
      await denied.click();
      await expect(denied).toHaveText(variant.failed);
      expect(
        await denied.evaluate((el) => {
          const label = el.querySelector('.cui-code-copy-label')!;
          const range = document.createRange();
          range.selectNodeContents(label);
          return range.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1;
        }),
      ).toBe(true);
      await session.detach();
      expect(await panel.locator('[data-artifact-source]').inputValue()).toBe(source);
      expect(
        await page.evaluate(() => (window as unknown as Record<string, unknown>).__markdownMustNotRun),
      ).toBeUndefined();
    });
  });
}
