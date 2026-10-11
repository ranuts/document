import { buildDocx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

test('PDF native text copy can read a virtual page selection without changing the real selection', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/embed-demo.html');
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  await page.evaluate(
    async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      await post('document:open-buffer', { fileName: 'source.docx', buffer: bytes.buffer, readonly: false });
      const saved = await post('document:save', { targetExt: 'PDF' });
      await post('document:open-buffer', {
        fileName: 'reading.pdf',
        buffer: await saved.file.arrayBuffer(),
        readonly: false,
      });
    },
    toBase64(
      buildDocx(
        '',
        '<w:p><w:r><w:t>PDF assistant sample. Budget is 120.</w:t></w:r></w:p><w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:r><w:t>Second page.</w:t></w:r></w:p>',
      ),
    ),
  );
  await page.waitForFunction(() => {
    const win = window.__ooFrames.readyEditor() as any;
    return !!win?.Asc.editor?.DocumentRenderer?.file?.pages?.[0]?.text;
  });
  const result = await page.evaluate(() => {
    const win = window.__ooFrames.readyEditor() as any;
    const api = win.Asc.editor;
    const file = api.DocumentRenderer.file;
    const before = JSON.stringify(file.Selection);
    const reader = Object.create(file);
    reader.isSelectionUse = () => true;
    reader.sortSelection = () => ({ Page1: 0, Page2: 0, Line1: 0, Line2: Infinity, Glyph1: 0, Glyph2: Infinity });
    const output = { Text: '' };
    file.copySelection.call(reader, 0, output);
    const pdf = api.getPDFDoc();
    return {
      text: output.Text,
      unchanged: before === JSON.stringify(file.Selection),
      currentPage: api.getCurrentPage(),
      pages: file.pages.length,
      addComment: typeof api.asc_addComment,
      apiAnnotation: typeof win.Api?.CreateTextAnnot,
      pdfHistory: !!pdf.History,
      annotCount: pdf.annots.length,
      sharedHistory: pdf.History === win.AscCommon.History,
    };
  });
  expect(result.text).toContain('PDF assistant sample. Budget is 120.');
  expect(result.unchanged).toBe(true);
  expect(result.currentPage).toBe(0);
  expect(result.pages).toBe(2);
  expect(result.addComment).toBe('function');
  expect(result.pdfHistory).toBe(true);
  const comment = await page.evaluate(() => {
    const win = window.__ooFrames.readyEditor() as any;
    const doc = win.Asc.editor.getPDFDoc();
    const before = doc.annots.length;
    const id = doc.DoAction(() => {
      const annot = win.AscPDF.CreateAnnotByProps(
        {
          rect: [20, 20, 40, 40],
          contents: 'Review this budget.',
          name: win.AscCommon.CreateGUID(),
          type: win.AscPDF.ANNOTATIONS_TYPES.Text,
          author: 'AI assistant',
        },
        doc,
      );
      doc.AddAnnot(annot, 1);
      return annot.GetId();
    }, win.AscDFH.historydescription_Pdf_AddComment);
    const added = doc.annots.find((a: any) => a.GetId() === id);
    const output = { page: added?.GetPage(), text: added?.GetContents(), count: doc.annots.length - before };
    win.Asc.editor.Undo();
    return { ...output, restored: doc.annots.length === before };
  });
  expect(comment).toEqual({ page: 1, text: 'Review this budget.', count: 1, restored: true });
  expect(result.sharedHistory).toBe(true);
  await page.evaluate(async () => {
    const api = (window.__ooFrames.readyEditor() as any).Asc.editor;
    api.Redo();
    const saved = await post('document:save', { targetExt: 'PDF' });
    await post('document:open-buffer', {
      fileName: 'annotated.pdf',
      buffer: await saved.file.arrayBuffer(),
      readonly: false,
    });
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window.__ooFrames.readyEditor() as any)?.Asc?.editor;
        return api?.getPDFDoc()?.annots?.map((a: any) => a.GetContents());
      }),
    )
    .toContain('Review this budget.');
  test.info().annotations.push({ type: 'pdf-contract', description: JSON.stringify(result) });
});

// Controlled provider responses validate the product flow, not model accuracy.
test('PDF assistant reads scoped content and reviews a page note before a reversible write', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/embed-demo.html');
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  const bytes = await page.evaluate(
    async (base64) => {
      const source = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      await post('document:open-buffer', { fileName: 'source.docx', buffer: source.buffer, readonly: false });
      const saved = await post('document:save', { targetExt: 'PDF' });
      return Array.from(new Uint8Array(await saved.file.arrayBuffer()));
    },
    toBase64(buildDocx('Budget is 120. Please review it.')),
  );
  await page.addInitScript(() =>
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'loopback',
        baseUrl: 'http://localhost:11434',
        model: 'pdf-test',
        preference: 'device-first',
        localWritingConsent: false,
      }),
    ),
  );
  let grounded = false;
  let groundedReadContinuation = false;
  await page.route('http://localhost:11434/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
      return;
    }
    if (route.request().url().endsWith('/tags')) {
      await route.fulfill({ json: { models: [{ name: 'pdf-test' }] } });
      return;
    }
    const request = route.request().postDataJSON();
    const prompt = JSON.stringify(request.messages);
    let output: unknown;
    if (request.format?.properties?.task)
      output = {
        task:
          prompt.includes('Add a note') || prompt.includes('Only the amount')
            ? 'tools'
            : prompt.includes('Rewrite the selected')
              ? 'rewrite'
              : 'chat',
        language: 'en',
      };
    else if (request.format?.properties?.text) output = { text: 'The budget is 120 and needs review.' };
    else if (request.format)
      output = prompt.includes('Only the amount')
        ? { tool: 'get_pdf_text', input: {} }
        : { tool: 'add_pdf_comment', input: { page: 1, text: 'Please check the budget.' } };
    else {
      grounded = prompt.includes('pdf-page') && prompt.includes('Budget is 120');
      groundedReadContinuation =
        prompt.includes('Original question:') &&
        prompt.includes('Only the amount') &&
        prompt.includes('Budget is 120') &&
        prompt.includes('get_pdf_text');
      output = groundedReadContinuation ? '120' : 'The current PDF page says the budget is 120.';
    }
    await route.fulfill({
      json: {
        done: true,
        done_reason: 'stop',
        message: { content: typeof output === 'string' ? output : JSON.stringify(output) },
      },
    });
  });
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#hero-open').click();
  await (await chooser).setFiles({ name: 'review.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
  await page.waitForURL(/\/editor/);
  await page.waitForFunction(
    () => !!(window.__ooFrames.readyEditor() as any)?.Asc.editor?.DocumentRenderer?.file?.pages?.[0]?.text,
  );
  await page.waitForFunction(() => typeof window.__toggleAgentPanel === 'function');
  // The entry must be present even though PDF has no desktop right rail.
  await expect(page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry')).toBeVisible();
  await page.evaluate(() => window.__toggleAgentPanel?.());
  await page.locator('.agent-enable-switch').click();
  await page.locator('.agent-panel-endpoint-connect').click();
  await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
  await page.locator('.agent-panel-settings-toggle').click();
  const input = page.locator('.cui-input');
  await input.fill('What does the current page say?');
  await input.press('Enter');
  await expect(page.locator('.cui-messages')).toContainText('budget is 120');
  expect(grounded).toBe(true);
  await input.fill('What is the budget on this page? Only the amount.');
  await input.press('Enter');
  await expect(page.locator('.cui-msg-agent .cui-bubble').last()).toHaveText('120');
  expect(groundedReadContinuation).toBe(true);
  await input.fill('Add a note to page 1: Please check the budget.');
  await input.press('Enter');
  const preview = page.locator('.agent-plan-preview').last();
  await expect(preview).toBeVisible();
  await expect(preview.locator('.agent-plan-target')).toHaveText('PDF · Page 1');
  await expect(preview.locator('.agent-plan-apply')).toHaveText('Add note');
  const annotations = () =>
    page.evaluate(() =>
      (window.__ooFrames.readyEditor() as any).Asc.editor
        .getPDFDoc()
        .annots.map((a: any) => ({ page: a.GetPage(), text: a.GetContents() })),
    );
  expect(await annotations()).toEqual([]);
  await preview.locator('.agent-plan-cancel').click();
  expect(await annotations()).toEqual([]);
  await input.fill('Add a note to page 1: Please check the budget.');
  await input.press('Enter');
  await expect(preview.locator('.agent-plan-apply')).toBeVisible();
  await preview.locator('.agent-plan-apply').click();
  await expect.poll(annotations).toEqual([{ page: 0, text: 'Please check the budget.' }]);
  await page.evaluate(() => (window.__ooFrames.readyEditor() as any).Asc.editor.Undo());
  await expect.poll(annotations).toEqual([]);
  await page.evaluate(() => {
    const api = (window.__ooFrames.readyEditor() as any).Asc.editor;
    Object.assign(api.DocumentRenderer.file.Selection, {
      Page1: 0,
      Page2: 0,
      Line1: 0,
      Line2: 10000,
      Glyph1: 0,
      Glyph2: 10000,
      IsSelection: true,
    });
  });
  await input.fill('Rewrite the selected text more clearly.');
  await input.press('Enter');
  await expect(page.locator('.cui-messages')).toContainText('The budget is 120 and needs review.');
  await expect(page.locator('.agent-plan-preview[data-state="pending"]:visible')).toHaveCount(0);
  expect(await annotations()).toEqual([]);
  await page.evaluate(() => {
    const doc = (window.__ooFrames.readyEditor() as any).Asc.editor.getPDFDoc();
    const original = doc.AddAnnot;
    doc.AddAnnot = function (...args: any[]) {
      doc.AddAnnot = original;
      original.apply(doc, args);
      throw new Error('Injected note failure');
    };
  });
  await input.fill('Add a note to page 1: Please check the budget.');
  await input.press('Enter');
  await expect(preview.locator('.agent-plan-apply')).toBeVisible();
  await preview.locator('.agent-plan-apply').click();
  await expect(preview).toHaveAttribute('data-state', 'failed');
  expect(await annotations()).toEqual([]);
  expect(await page.evaluate(() => (window.__ooFrames.readyEditor() as any).Asc.editor.getPDFDoc().Action.Start)).toBe(
    false,
  );
  await input.fill('Add a note to page 1: Please check the budget.');
  await input.press('Enter');
  await expect(preview.locator('.agent-plan-apply')).toBeVisible();
  await preview.locator('.agent-plan-apply').click();
  await expect.poll(annotations).toEqual([{ page: 0, text: 'Please check the budget.' }]);
  await page.evaluate(() => (window.__ooFrames.readyEditor() as any).Asc.editor.Undo());
  await expect.poll(annotations).toEqual([]);
});
