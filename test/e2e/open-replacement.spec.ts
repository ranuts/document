import { expect, test } from './lib/l0';
import { waitForEditorReady } from './actions/editor';
import { buildDocx, toBase64 } from './lib/ooxml';

test('a failed newer download leaves an in-progress replacement usable', async ({ page, l0 }) => {
  test.setTimeout(120_000);
  l0.allowConsole(/^Error opening document from URL:/);
  await page.route('https://files.example.invalid/missing-replacement.docx', (route) =>
    route.fulfill({ status: 404, body: 'missing', headers: { 'Access-Control-Allow-Origin': '*' } }),
  );
  await page.goto('/embed-demo.html');
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  const base64 = toBase64(buildDocx('A replacement remains available after a failed download.'));
  await page.evaluate(async (base64) => {
    const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
    await post('document:open-buffer', { fileName: 'original.docx', buffer });
  }, base64);
  await waitForEditorReady(page);

  await page.evaluate((base64) => {
    const state = window as any;
    const child = (document.querySelector('#editorFrame') as HTMLIFrameElement).contentWindow as any;
    const destroy = child.editor.destroyEditor.bind(child.editor);
    child.editor.destroyEditor = () => {
      state.replacementTeardown = true;
      return destroy();
    };
    const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
    state.replacementResult = post('document:open-buffer', { fileName: 'replacement.docx', buffer }).then(
      () => 'opened',
      (error) => String(error),
    );
  }, base64);
  await page.waitForFunction(() => (window as any).replacementTeardown === true);
  const failed = await page.evaluate(async () => {
    try {
      await post('document:open-url', { url: 'https://files.example.invalid/missing-replacement.docx' });
      return 'opened';
    } catch (error) {
      return String(error);
    }
  });
  expect(failed).toContain('404');
  expect(await page.evaluate(() => (window as any).replacementResult)).toBe('opened');
  await waitForEditorReady(page);
  const saved = await page.evaluate(async () => {
    const { file } = await post('document:save', { targetExt: 'DOCX' });
    return { name: file.name, size: file.size };
  });
  expect(saved.name).toBe('replacement.docx');
  expect(saved.size).toBeGreaterThan(0);
});
