import { expect, test } from './lib/l0';
import { buildDocx } from './lib/ooxml';

for (const entry of ['docx', 'xlsx', 'pptx', 'open'] as const) {
  test(`English homepage keeps ${entry} and its assistant English after a Chinese preference`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      localStorage.setItem('document-lang', 'zh');
      localStorage.setItem('document-assistant-enabled', 'true');
      document.cookie = 'locale=zh-CN;path=/';
    });
    await page.goto('/');
    if (entry === 'open') {
      const chooser = page.waitForEvent('filechooser');
      await page.locator('#hero-open').click();
      await (
        await chooser
      ).setFiles({
        name: 'locale-test.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from(buildDocx('English document.')),
      });
    } else await page.locator(`#hero-new-${entry}`).click();
    await page.waitForURL('**/editor?**');
    expect(new URL(page.url()).searchParams.get('locale')).toBe('en');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const editor = page.frameLocator('iframe[name="frameEditor"]');
    await expect(editor.locator('.ribtab').filter({ hasText: /^Home$/ })).toBeVisible();
    await editor.locator('.agent-sidebar-entry').click();
    await expect(page.locator('.agent-panel-title')).toHaveText('AI Assistant');
  });
}

test('an unsupported language uses English in the editor and assistant despite an old Chinese preference', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem('document-lang', 'zh');
    localStorage.setItem('document-assistant-enabled', 'true');
    document.cookie = 'locale=zh-CN;path=/';
  });
  await page.goto('/editor?new=docx&locale=fa');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const editor = page.frameLocator('iframe[name="frameEditor"]');
  await expect(editor.locator('.ribtab').filter({ hasText: /^Home$/ })).toBeVisible();
  await editor.locator('.agent-sidebar-entry').click();
  await expect(page.locator('.agent-panel-title')).toHaveText('AI Assistant');
  await expect(page.locator('.agent-speech-language')).toHaveJSProperty('value', 'en-US');
});

for (const width of [360, 640]) {
  test(`model loading has aligned text actions and breathing room at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('document-assistant-enabled', 'true');
      localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
      Object.defineProperty(navigator, 'gpu', { value: undefined });
    });
    // Hold the model request to exercise cancellation and layout without
    // downloading weights. A CPU-only browser takes this same loading path.
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('https://huggingface.co/**', async (route) => {
      await pending;
      await route.abort();
    });
    await page.goto('/editor?new=docx&locale=en');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
    await page.locator('.agent-panel-settings-toggle').click();
    await page.locator('.agent-panel-load').click();
    await expect(page.locator('.agent-panel-load-stop')).toBeVisible();
    await expect(page.locator('.agent-panel-load-stop')).toBeFocused();
    const geometry = () =>
      page.locator('.agent-runtime-row').evaluate((row) => {
        const status = row.querySelector<HTMLElement>('.agent-model-status')!;
        const stop = row.querySelector<HTMLElement>('.agent-panel-load-stop')!;
        const progress = row.querySelector('progress')!;
        const r = row.getBoundingClientRect();
        const s = status.getBoundingClientRect();
        const b = stop.getBoundingClientRect();
        const p = progress.getBoundingClientRect();
        return {
          aligned: Math.abs((s.top + s.bottom) / 2 - (b.top + b.bottom) / 2) < 2,
          noOverlap: s.right <= b.left,
          progressBelow: p.top >= Math.max(s.bottom, b.bottom),
          insetTop: Math.min(s.top, b.top) - r.top,
          insetBottom: r.bottom - p.bottom,
          height: b.height,
          variant: stop.getAttribute('type'),
          shadow: getComputedStyle(stop).boxShadow,
          overflow: row.scrollWidth - row.clientWidth,
        };
      });
    const settings = await geometry();
    expect(settings).toMatchObject({
      aligned: true,
      noOverlap: true,
      progressBelow: true,
      variant: 'text',
      shadow: 'none',
    });
    expect(settings.height).toBeLessThanOrEqual(34);
    expect(settings.insetTop).toBeGreaterThanOrEqual(8);
    expect(settings.insetBottom).toBeGreaterThanOrEqual(8);
    expect(settings.overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('loading-settings.png') });
    await page.locator('.agent-panel-load-stop').press('Enter');
    await expect(page.locator('.agent-runtime-row')).toBeHidden();
    await expect(page.locator('.agent-panel-load')).toBeFocused();
    await page.locator('.agent-panel-load').press('Enter');
    await expect(page.locator('.agent-panel-load-stop')).toBeVisible();
    await page.locator('.agent-panel-settings-toggle').click();
    const chat = await geometry();
    expect(chat).toMatchObject({
      aligned: true,
      noOverlap: true,
      progressBelow: true,
      variant: 'text',
      shadow: 'none',
    });
    expect(chat.insetTop).toBeGreaterThanOrEqual(8);
    expect(chat.insetBottom).toBeGreaterThanOrEqual(8);
    const input = page.locator('.cui-input');
    const send = page.locator('.cui-send');
    await input.fill('Polish the selected text');
    await expect(send).toHaveClass(/cui-send-prepare/);
    await expect(send).toBeDisabled();
    await expect(page.locator('.agent-readiness')).toBeHidden();
    const composer = await page.locator('.cui-composer').evaluate((wrap) => {
      const action = wrap.querySelector('.cui-send')!;
      const w = wrap.getBoundingClientRect();
      const a = action.getBoundingClientRect();
      return { contained: a.left >= w.left && a.right <= w.right, overflow: wrap.scrollWidth - wrap.clientWidth };
    });
    expect(composer.contained).toBe(true);
    expect(composer.overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('loading-chat.png') });
    await page.locator('.agent-panel-load-stop').click();
    await expect(page.locator('.agent-runtime-row')).toBeHidden();
    await expect(input).toHaveValue('Polish the selected text');
    release();
    await expect(send).toBeEnabled();
    await expect(page.locator('.cui-msg-user')).toHaveCount(0);
  });
}
