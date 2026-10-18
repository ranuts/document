import { mockApi } from './lib/mock-api';
import { expect, test } from './lib/l0';
import type { Page } from '@playwright/test';

async function open(page: Page, ext = 'docx', kind = 'loopback') {
  await page.addInitScript((kind) => {
    const baseUrl = kind === 'loopback' ? 'http://localhost:11434' : 'https://assistant.example.invalid/v1';
    if (kind !== 'loopback') localStorage.setItem(`agent_endpoint_key_${encodeURIComponent(baseUrl)}`, 'test-key');
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind,
        baseUrl,
        model: 'workspace-test',
        preference: 'device-first',
        localWritingConsent: false,
      }),
    );
  }, kind);
  await page.goto(`/editor?new=${ext}&locale=en`);
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
}
async function selectWord(page: Page) {
  await page.evaluate(() => {
    const win = window.__ooFrames.readyEditor() as any;
    const api = win.Asc?.editor ?? win.editor;
    api.pluginMethod_InputText('The project is going well and we are making good progress.');
    api.asc_EditSelectAll();
  });
  await expect(page.locator('.agent-quoted-text')).toContainText('The project');
}

test('selected Word task stages without calls, skips classification, reviews and undoes', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  let classification = 0,
    writing = 0;
  await mockApi(page, 'http://localhost:11434/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
      return;
    }
    if (route.request().url().endsWith('/tags')) {
      await route.fulfill({ json: { models: [{ name: 'workspace-test' }] } });
      return;
    }
    const body = route.request().postDataJSON();
    const routing = !!body.format?.properties?.task;
    if (routing) classification++;
    else writing++;
    await route.fulfill({
      json: {
        done: true,
        message: {
          role: 'assistant',
          content: routing
            ? JSON.stringify({ task: 'rewrite', language: 'en' })
            : JSON.stringify({ text: 'The project is progressing well.' }),
        },
      },
    });
  });
  await open(page);
  await selectWord(page);
  await page.locator('[data-task="polish"]').click();
  expect(classification + writing).toBe(0);
  await expect(page.locator('.cui-input')).toHaveValue(/Polish/);
  await expect(page.locator('.cui-input')).toBeFocused();
  const original = await page.locator('.cui-input').inputValue();
  // Setup preserves the staged draft; choose the task again after connecting.
  await page.locator('.cui-send').click();
  await page.locator('.agent-panel-endpoint-connect').click();
  await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
  await page.locator('.agent-panel-settings-toggle').click();
  await expect(page.locator('.cui-send')).toHaveAccessibleName('Send');
  await expect(page.locator('.cui-input')).toHaveValue(original);
  await page.locator('.cui-input').fill('');
  await page.locator('[data-task="polish"]').click();
  for (const [width, theme] of [
    [432, 'light'],
    [520, 'light'],
    [320, 'dark'],
  ] as const) {
    await page.evaluate(
      ({ width, theme }) => {
        document.documentElement.style.setProperty('--agent-panel-width', `${width}px`);
        document.documentElement.setAttribute('data-ran-theme', theme);
      },
      { width, theme },
    );
    await page.screenshot({ path: testInfo.outputPath(`workspace-word-${width}-${theme}.png`) });
  }
  await page.locator('.cui-send').click();
  const preview = page.locator('.agent-plan-preview').last();
  await expect(preview).toHaveAttribute('data-state', 'pending');
  expect(classification).toBe(0);
  expect(writing).toBe(1);
  await expect(preview.locator('.agent-plan-diff')).toContainText('progressing well.');
  const beforeApply = await page.evaluate(() => {
    const win = window.__ooFrames.readyEditor() as any;
    return (win.Asc?.editor ?? win.editor).pluginMethod_GetSelectedText({ Numbering: false });
  });
  expect(beforeApply).toContain('we are making good progress');
  await preview.locator('.agent-plan-apply').click();
  await expect(preview).toHaveAttribute('data-state', 'verified');
  const read = () =>
    page.evaluate(() => {
      const win = window.__ooFrames.readyEditor() as any;
      const api = win.Asc?.editor ?? win.editor;
      api.asc_EditSelectAll();
      return api.pluginMethod_GetSelectedText({ Numbering: false });
    });
  expect(await read()).toContain('The project is progressing well.');
  await page.evaluate(() => {
    const win = window.__ooFrames.readyEditor() as any;
    (win.Asc?.editor ?? win.editor).Undo();
  });
  expect(await read()).toContain('we are making good progress');
  await page.screenshot({ path: testInfo.outputPath('workspace-review.png') });
  await page.locator('.agent-panel-clear').click();
  await expect(page.locator('[data-task="polish"]')).toBeVisible();
  await page.locator('[data-task="polish"]').click();
  await page.locator('.cui-input').fill('Polish the selection, making it shorter.');
  await page.locator('.cui-send').click();
  await expect(page.locator('.agent-plan-preview').last()).toHaveAttribute('data-state', 'pending');
  expect(classification).toBe(1);
  expect(writing).toBe(2);
});

test('stale selected task retains draft and requests reselection before any model call', async ({ page }) => {
  test.setTimeout(120_000);
  let calls = 0;
  await mockApi(page, 'http://localhost:11434/api/**', async (route) => {
    if (route.request().url().endsWith('/tags')) {
      await route.fulfill({ json: { models: [{ name: 'workspace-test' }] } });
      return;
    }
    calls++;
    await route.fulfill({ json: { done: true, message: { role: 'assistant', content: 'unexpected' } } });
  });
  await open(page);
  await page.locator('.agent-panel-settings-toggle').click();
  await page.locator('.agent-panel-endpoint-connect').click();
  await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
  await page.locator('.agent-panel-settings-toggle').click();
  await selectWord(page);
  await page.locator('[data-task="polish"]').click();
  const draft = await page.locator('.cui-input').inputValue();
  await page.evaluate(() => {
    const win = window.__ooFrames.readyEditor() as any;
    const api = win.Asc?.editor ?? win.editor;
    api.pluginMethod_InputText('Replacement source');
  });
  await page.locator('.cui-send').click();
  expect(calls).toBe(0);
  await expect(page.locator('.agent-staged-guidance')).toContainText('changed');
  await expect(page.locator('.cui-input')).toHaveValue(draft);
  await expect(page.locator('.agent-task-help')).toContainText('changed');
});

for (const ext of ['xlsx', 'pptx'])
  test(`${ext} entry describes the actual current scope`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await open(page, ext);
    await expect(page.locator('.agent-task-action')).toHaveCount(2);
    await expect(page.locator('.agent-task-scope')).toContainText(ext === 'xlsx' ? 'Sheet1' : 'Slide');
    for (const [width, theme] of [
      [432, 'light'],
      [520, 'light'],
      [320, 'dark'],
    ] as const) {
      await page.evaluate(
        ({ width, theme }) => {
          document.documentElement.style.setProperty('--agent-panel-width', `${width}px`);
          document.documentElement.setAttribute('data-ran-theme', theme);
        },
        { width, theme },
      );
      await page.screenshot({ path: testInfo.outputPath(`workspace-${ext}-${width}-${theme}.png`) });
      const overflow = await page.locator('.agent-task-entry').evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
    }
  });

test('native provider still routes staged polish through writing and review', async ({ page }) => {
  test.setTimeout(120_000);
  let classifications = 0,
    writing = 0;
  await mockApi(page, 'https://assistant.example.invalid/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON();
    const routing = !!body.response_format?.json_schema?.schema?.properties?.task;
    if (routing) classifications++;
    else writing++;
    expect(body.tools ?? []).toHaveLength(0);
    await route.fulfill({
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify(
                routing ? { task: 'rewrite', language: 'en' } : { text: 'The project is progressing well.' },
              ),
            },
            finish_reason: 'stop',
          },
        ],
      },
    });
  });
  await open(page, 'docx', 'openai-compatible');
  await page.locator('.agent-panel-settings-toggle').click();
  await page.locator('.agent-panel-endpoint-connect').click();
  await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Configured');
  await page.locator('.agent-panel-settings-toggle').click();
  await selectWord(page);
  await page.locator('[data-task="polish"]').click();
  await page.locator('.cui-send').click();
  await expect(page.locator('.agent-plan-preview')).toHaveAttribute('data-state', 'pending');
  expect(classifications).toBe(0);
  expect(writing).toBe(1);
});

test('PDF entry offers current-page summaries without claiming body editing', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'loopback',
        baseUrl: 'http://localhost:11434',
        model: 'workspace-test',
        preference: 'device-first',
        localWritingConsent: false,
      }),
    );
  });
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#hero-open').click();
  const pdf =
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF';
  await (await chooser).setFiles({ name: 'entry.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) });
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
  await expect(page.locator('.agent-task-scope')).toContainText('PDF · Page 1');
  await expect(page.locator('[data-task="page"]')).toBeVisible();
  await expect(page.locator('[data-task="points"]')).toBeVisible();
  await expect(page.locator('[data-task="polish"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('workspace-pdf.png') });
});
