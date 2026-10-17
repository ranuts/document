import { expect, test } from './lib/l0';
import { zip, textPdf } from '../fixtures/helpers/reference-files';

test('Office and PDF references attach without replacing the current document, including offline', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  const editor = page.frameLocator('iframe[name="frameEditor"]');
  await editor.locator('.agent-sidebar-entry').click();
  await page.locator('.agent-sources-toggle').click();
  // The same editor object and history remain untouched while unrelated files are parsed.
  await page.evaluate(() => {
    const frame = window.__ooFrames.readyEditor()!;
    (window as any).__referenceEditor = frame;
  });
  const documentState = () =>
    page.evaluate(() => {
      const win = window.__ooFrames.readyEditor() as any;
      const logic = (win.Asc?.editor ?? win.editor).WordControl.m_oLogicDocument;
      const paragraphs: any[] = [];
      for (const element of logic.Content) element.GetAllParagraphs({ All: true }, paragraphs);
      return {
        text: paragraphs.map((p) => p.GetText({ Numbering: false })).join('\n'),
        history: win.AscCommon.History.Index,
      };
    });
  const before = await documentState();
  const files = [
    {
      name: 'report.docx',
      buffer: Buffer.from(zip({ 'word/document.xml': '<x><p><t>Word reference</t></p></x>' }, true)),
    },
    {
      name: 'slides.pptx',
      buffer: Buffer.from(
        zip(
          {
            'ppt/presentation.xml':
              '<x xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sldId r:id="a"/></x>',
            'ppt/_rels/presentation.xml.rels':
              '<Relationships><Relationship Id="a" Target="slides/slide1.xml"/></Relationships>',
            'ppt/slides/slide1.xml': '<x><p><t>Slide reference</t></p></x>',
          },
          true,
        ),
      ),
    },
    {
      name: 'budget.xlsx',
      buffer: Buffer.from(
        zip(
          {
            'xl/workbook.xml':
              '<x xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheet name="Budget" r:id="a"/></x>',
            'xl/_rels/workbook.xml.rels':
              '<Relationships><Relationship Id="a" Target="worksheets/sheet1.xml"/></Relationships>',
            'xl/worksheets/sheet1.xml':
              '<worksheet><row><c t="inlineStr"><is><t>Sheet reference</t></is></c></row></worksheet>',
          },
          true,
        ),
      ),
    },
    { name: 'reference.pdf', buffer: textPdf('PDF reference') },
  ];
  for (const file of files) {
    await page
      .locator('.agent-sources-view input[type=file]')
      .setInputFiles({ ...file, mimeType: 'application/octet-stream' });
    await expect(page.locator('.agent-source-row').filter({ hasText: file.name })).toBeVisible();
    await expect(page.locator('.agent-sources-status')).toHaveText('');
  }
  expect(await page.evaluate(() => window.__ooFrames.readyEditor() === (window as any).__referenceEditor)).toBe(true);
  expect(await documentState()).toEqual(before);
  // Parsing the PDF activates its offline capability; no generic assistant
  // enable or explicit test-only preparation should be needed for reuse.
  await expect
    .poll(() => page.evaluate(async () => Boolean(await caches.match('/__document-assistant-prepared__/pdf'))), {
      timeout: 60_000,
    })
    .toBe(true);
  await page.evaluate(async () => {
    const source = await (await fetch('/sw.js')).text();
    const optional: string[] = JSON.parse(/const ASSISTANT_CAPABILITY_ASSETS = (\{.*?\});/.exec(source)![1]).pdf;
    const worker = optional.find((path) => /pdf\.worker.*\.mjs$/.test(path));
    if (!worker) throw new Error('PDF worker not prepared');
    const response = await fetch(worker);
    if (!/javascript/.test(response.headers.get('content-type') ?? '')) throw new Error('Invalid module worker MIME');
    if (response.headers.get('cross-origin-embedder-policy') !== 'require-corp')
      throw new Error('Missing module worker isolation');
  });
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await editor.locator('.agent-sidebar-entry').click();
  await page.locator('.agent-sources-toggle').click();
  await page
    .locator('.agent-sources-view input[type=file]')
    .setInputFiles({ name: 'offline.pdf', mimeType: 'application/pdf', buffer: textPdf('Offline PDF reference') });
  await expect(page.locator('.agent-source-row').filter({ hasText: 'offline.pdf' })).toBeVisible();
  await page
    .locator('.agent-sources-view input[type=file]')
    .setInputFiles({ ...files[0], mimeType: 'application/octet-stream' });
  await expect(page.locator('.agent-source-row').filter({ hasText: 'report.docx' })).toBeVisible();
  const styleState = await page.evaluate(async () => ({
    font: getComputedStyle(document.documentElement).fontFamily,
    panel: getComputedStyle(document.querySelector('.agent-runtime-panel')!).position,
    links: await Promise.all(
      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]')).map(async (link) => ({
        href: link.href,
        sheet: !!link.sheet,
        response: await fetch(link.href)
          .then(async (r) => ({
            status: r.status,
            type: r.headers.get('content-type'),
            length: (await r.text()).length,
          }))
          .catch((e) => String(e)),
      })),
    ),
  }));
  await testInfo.attach('offline-style-state', { body: JSON.stringify(styleState), contentType: 'application/json' });
  expect(styleState.panel).toBe('fixed');
  expect(styleState.font).not.toContain('Times');
  await page.setViewportSize({ width: 360, height: 740 });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    const bounds = await page.locator('.agent-runtime-panel').boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(360);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    await expect
      .poll(() => page.locator('.agent-runtime-panel').evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThan(2);
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`references-${theme}.png`) });
  }
});
