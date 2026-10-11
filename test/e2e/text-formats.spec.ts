import { expect, test } from './lib/l0';

for (const ext of ['txt', 'rtf'] as const) {
  test(`${ext}: preserves text after native save and reopen, and exports PDF`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
    const result = await page.evaluate(async (format) => {
      const marker = 'Regression paragraph 7319';
      const source = format === 'rtf' ? `{\\rtf1\\ansi ${marker}\\par}` : marker;
      const bytes = new TextEncoder().encode(source);
      await post('document:open-buffer', { fileName: `fixture.${format}`, buffer: bytes.buffer, readonly: false });
      const native = await post('document:save', { targetExt: format.toUpperCase() });
      await post('document:open-buffer', {
        fileName: native.file.name,
        buffer: await native.file.arrayBuffer(),
        readonly: false,
      });
      const text = await post('document:save', { targetExt: 'TXT' });
      const pdf = await post('document:save', { targetExt: 'PDF' });
      return {
        name: native.file.name,
        text: await text.file.text(),
        pdf: String.fromCharCode(...new Uint8Array(await pdf.file.arrayBuffer()).slice(0, 4)),
      };
    }, ext);
    expect(result.name).toBe(`fixture.${ext}`);
    expect(result.text).toContain('Regression paragraph 7319');
    expect(result.pdf).toBe('%PDF');
  });
}
