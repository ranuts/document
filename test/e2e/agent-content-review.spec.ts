import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, test } from './lib/l0';

const endpoint = 'https://assistant.example.invalid/v1';
async function open(
  page: Page,
  ext: 'docx' | 'pptx' | 'xlsx',
  calls: Array<{ name: string; input: Record<string, unknown> }>,
) {
  await page.addInitScript((baseUrl) => {
    localStorage.setItem(`agent_endpoint_key_${encodeURIComponent(baseUrl)}`, 'test-only-key');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'openai-compatible',
        baseUrl,
        model: 'content-test',
        preference: 'device-first',
        localWritingConsent: false,
      }),
    );
  }, endpoint);
  let requested = 0;
  await page.route(`${endpoint}/chat/completions`, async (route) => {
    const call = calls[requested++];
    await route.fulfill({
      json: {
        choices: [
          {
            message: call
              ? {
                  content: null,
                  tool_calls: [
                    {
                      id: `call-${requested}`,
                      type: 'function',
                      function: { name: call.name, arguments: JSON.stringify(call.input) },
                    },
                  ],
                }
              : { content: 'Finished the requested task.' },
            finish_reason: call ? 'tool_calls' : 'stop',
          },
        ],
      },
    });
  });
  await page.goto(`/editor?new=${ext}`);
  await page.waitForFunction(
    () => Boolean(window.__ooFrames.readyEditor()) && typeof window.__toggleAgentPanel === 'function',
  );
  await page.evaluate(() => window.__toggleAgentPanel?.());
  await page.locator('.agent-enable-switch').click();
  await page.locator('.agent-panel-settings-toggle').click();
  await page.locator('.agent-panel-endpoint-connect').click();
  await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Configured');
  await page.locator('.agent-panel-settings-toggle').click();
}
const undo = (page: Page) =>
  page.evaluate(() => {
    const win = window.__ooFrames.readyEditor() as any;
    (win.Asc?.editor ?? win.editor).Undo();
  });

test('formatted Word content retains native headings and lists with safe readback and one Undo', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await open(page, 'docx', [
    {
      name: 'insert_text',
      input: { text: '# Budget\n\n**Approved**  budget\nPayment 120 EUR\n\n- 120\n- November 1', format: 'markdown' },
    },
  ]);
  const read = () =>
    page.evaluate(() => {
      const win = window.__ooFrames.readyEditor() as any;
      const logic = (win.Asc?.editor ?? win.editor).WordControl.m_oLogicDocument;
      const paragraphs: any[] = [];
      for (const element of logic.Content) element.GetAllParagraphs({ All: true }, paragraphs);
      return paragraphs.map((p: any) => ({
        text: p.GetText({ Numbering: false }).replace(/\r\n?/g, '\n'),
        style: p.Style_Get?.() ? logic.GetStyles().Get(p.Style_Get()).Name : null,
        numbered: !!p.GetNumPr?.(),
      }));
    });
  const before = await read();
  await page.locator('.cui-input').fill('Insert the formatted project budget with a heading and a list.');
  await page.locator('.cui-input').press('Enter');
  const preview = page.locator('.agent-plan-preview').last();
  await expect(preview.locator('.agent-plan-diff')).toContainText('Budget');
  expect(await read()).toEqual(before);
  await preview.locator('.agent-plan-apply').click();
  await expect.poll(() => preview.getAttribute('data-state')).not.toBe('applying');
  await testInfo.attach('native-word-format.json', {
    body: JSON.stringify({ before, after: await read() }),
    contentType: 'application/json',
  });
  await expect(preview).toHaveAttribute('data-state', 'verified');
  const after = await read();
  expect(after.map((p: any) => p.text.trim())).toEqual([
    'Budget',
    'Approved  budget\nPayment 120 EUR',
    '120',
    'November 1',
    '',
  ]);
  expect(after[0].style).not.toEqual(before[0].style);
  expect(after.slice(2, 4).every((p: any) => p.numbered)).toBe(true);
  await expect(page.locator('.cui-send-stop')).toHaveCount(0);
  await expect(page.locator('.cui-msg-error')).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  await page
    .frameLocator('iframe[name="frameEditor"]')
    .getByRole('button', { name: 'Save (Ctrl+S)', exact: true })
    .click();
  const download = await downloadPromise;
  const saved = await download.path();
  expect(saved).toBeTruthy();
  await undo(page);
  expect(await read()).toEqual(before);
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#hero-open').click();
  await (
    await chooser
  ).setFiles({
    name: 'budget.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await readFile(saved!),
  });
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  expect(await read()).toEqual(after);
});

test('long presentation content fits every native page, preserves Unicode and is undone once', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const body = Array.from({ length: 60 }, (_, i) => `项目 ${i + 1} · Payment 😀 · approved budget 120 EUR`).join('\n');
  await open(page, 'pptx', [{ name: 'create_slide', input: { title: 'Project budget · 项目预算', body } }]);
  const read = () =>
    page.evaluate(() => {
      const win = window.__ooFrames.readyEditor() as any;
      const api = win.Asc?.editor ?? win.editor;
      return api.WordControl.m_oLogicDocument.Slides.map((slide: any) =>
        slide.cSld.spTree.map((shape: any) => {
          const content = shape.getDocContent?.();
          const rect = shape.getTextRect?.();
          return {
            text: content?.GetText({})?.replace(/\r\n?/g, '\n') ?? '',
            height: content?.GetSummaryHeight?.(),
            available: rect ? rect.b - rect.t : undefined,
          };
        }),
      );
    });
  const before = await read();
  await page.locator('.cui-input').fill('Add slides for the project budget, preserving all items.');
  await page.locator('.cui-input').press('Enter');
  const preview = page.locator('.agent-plan-preview').last();
  await expect(preview).toHaveAttribute('data-state', 'pending');
  await preview.locator('.agent-plan-apply').click();
  await expect(preview).toHaveAttribute('data-state', 'verified', { timeout: 30000 });
  await expect(page.locator('.cui-send-stop')).toHaveCount(0);
  await expect(page.locator('.cui-msg-error')).toHaveCount(0);
  const after = await read();
  const added = after.slice(before.length);
  expect(added.length).toBeGreaterThan(1);
  expect(
    added.every(
      (shapes: any[]) => shapes.length === 2 && shapes.every((shape: any) => shape.height <= shape.available + 0.01),
    ),
  ).toBe(true);
  // The SDK's raw GetText loses supplementary Unicode. Read native code points
  // through the app's independently verified adapter before comparing all text.
  const actual = await page.evaluate(async (start) => {
    const win = window.__ooFrames.readyEditor() as any;
    const slides = (win.Asc?.editor ?? win.editor).WordControl.m_oLogicDocument.Slides.slice(start);
    return slides
      .map((s: any) =>
        s.cSld.spTree[1]
          .getDocContent()
          .Content.map((p: any) =>
            p.Content.map(
              (run: any) =>
                run.Content?.map((c: any) =>
                  c.GetCodePoint
                    ? String.fromCodePoint(c.GetCodePoint())
                    : c.Type === 4
                      ? '\n'
                      : c.Type === 21
                        ? '\t'
                        : '',
                ).join('') ?? '',
            ).join(''),
          )
          .join('')
          .replace(/\n$/, ''),
      )
      .join('');
  }, before.length);
  expect(actual.replace(/\n$/, '')).toBe(body);
  await expect(preview.locator('.agent-plan-status')).toContainText(`Slides added: ${added.length}`);
  await page.screenshot({ path: testInfo.outputPath('fitted-slides.png') });
  await undo(page);
  expect(await read()).toEqual(before);
});

test('read progress states its scope and disclosure text shares the marker line without stealing focus', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open(page, 'xlsx', [{ name: 'get_range', input: { range: 'B2:C4' } }]);
  await page.locator('.cui-input').fill('Read cells B2:C4.');
  await page.locator('.cui-input').press('Enter');
  await expect(page.locator('.cui-send-stop')).toHaveCount(0);
  const summary = page.locator('.cui-activity summary').last();
  await expect(summary).toContainText('Read: Sheet1 · B2:C4');
  const offset = await summary.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element.firstElementChild!);
    return range.getBoundingClientRect().top - element.getBoundingClientRect().top;
  });
  expect(offset).toBeLessThan(12);
  await summary.focus();
  await summary.press('Enter');
  await expect(summary.locator('..')).toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  expect(await summary.ariaSnapshot()).toContain('Read: Sheet1');
  expect(
    await page.evaluate(() => {
      const win = window.__ooFrames.readyEditor() as any;
      return (win.Asc?.editor ?? win.editor).asc_getActiveRangeStr();
    }),
  ).toBe('A1');
});
