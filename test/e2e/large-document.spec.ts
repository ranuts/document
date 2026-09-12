import { buildDocx, ooxmlText, toBase64, zipEntryText } from './lib/ooxml';
import { expect, test } from './lib/l0';

/**
 * Size as its own dimension (matrix section B, "体积").
 *
 * Everything else in the synthetic suite is a few kilobytes, and the corpus
 * run is the only place a multi-megabyte file is ever opened -- which means
 * size is only covered on the machines that have a private corpus, and only
 * for whatever happens to be in it. This builds one instead: a document large
 * enough that opening it is a real allocation and saving it moves real bytes,
 * pinned to a budget so a regression shows up as a timeout rather than as a
 * slow afternoon nobody measured.
 *
 * The paragraphs are numbered so the middle and the two ends can be checked
 * without holding the whole document in an expectation. Two megabytes is the
 * low end of what the matrix calls for, and it is deliberate: the fixture is
 * built in memory on every run, and the failures worth catching here (a body
 * truncated on the way through, an open that has become quadratic) show up at
 * this size as readily as at sixty.
 */
const PARAGRAPHS = 20_000;
const FIRST = 'first paragraph 第一段';
const LAST = `paragraph ${PARAGRAPHS} 最后一段`;

const buildLargeDocx = (): Uint8Array => {
  const body: string[] = [`<w:p><w:r><w:t>${FIRST}</w:t></w:r></w:p>`];
  for (let i = 2; i < PARAGRAPHS; i++) {
    body.push(`<w:p><w:r><w:t>paragraph ${i} line of ordinary prose to give the file some weight</w:t></w:r></w:p>`);
  }
  body.push(`<w:p><w:r><w:t>${LAST}</w:t></w:r></w:p>`);
  return buildDocx('', body.join(''));
};

test.describe('a multi-megabyte document (real editor)', () => {
  // Generous next to the measured time, because this is a budget rather than
  // a benchmark: it should catch an order-of-magnitude regression and never
  // fail for being on a busy runner.
  test.describe.configure({ timeout: 240_000 });

  test('opens, saves and keeps both ends inside the budget', async ({ page }) => {
    const docx = buildLargeDocx();
    expect(docx.byteLength, 'the fixture has to actually be large').toBeGreaterThan(1_500_000);

    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    const result = await page.evaluate(
      async ({ b64 }) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

        const openedAt = Date.now();
        await post('document:open-buffer', { fileName: 'large.docx', buffer: bytes.buffer, readonly: false });
        const openMs = Date.now() - openedAt;

        const savedAt = Date.now();
        const saved = await post('document:save', {});
        const saveMs = Date.now() - savedAt;

        const out = new Uint8Array(await saved.file.arrayBuffer());
        let s = '';
        for (let i = 0; i < out.length; i += 0x8000)
          s += String.fromCharCode.apply(null, Array.from(out.subarray(i, i + 0x8000)));
        return { openMs, saveMs, name: saved.file.name as string, size: out.byteLength, b64: btoa(s) };
      },
      { b64: toBase64(docx) },
    );

    test.info().annotations.push({
      type: 'large-doc',
      description: `${docx.byteLength} B in, ${result.size} B out, open ${result.openMs} ms, save ${result.saveMs} ms`,
    });

    expect(result.name).toBe('large.docx');

    // The saved file's own size says little -- the fixture is a stored zip and
    // the engine deflates prose that repetitive down to a fraction of it. What
    // has to be large is the text that comes back out, which is also what
    // catches a middle silently dropped on the way through.
    const bytes = new Uint8Array(Buffer.from(result.b64, 'base64'));
    const text = ooxmlText((await zipEntryText(bytes, 'word/document.xml')) || '');
    expect(text.length, 'the body came back whole').toBeGreaterThan(1_000_000);
    expect(text).toContain(FIRST);
    expect(text).toContain(LAST);
    expect(text).toContain(`paragraph ${Math.floor(PARAGRAPHS / 2)} `);

    // One budget for the pair, not two. `document:open-buffer` resolves once
    // the open has been handed over rather than once the document is on
    // screen, so its own number is not a load time -- the waiting it does not
    // account for lands in the save instead.
    expect(result.openMs + result.saveMs, 'a few megabytes through the editor must not take a minute').toBeLessThan(
      90_000,
    );
  });
});
