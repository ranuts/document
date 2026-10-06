import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const origin = 'http://127.0.0.1:5193';
const source = '请保留这段原始内容。'.repeat(500);
const report = {
  scope:
    'Current production CPU selected-text summary of a synthetic source within the 8000-character application limit, testing actual native context rejection and unchanged document; no broad writing-quality or memory claim.',
  sourceLength: source.length,
  status: 'running',
  consoleErrors: [],
  errors: [],
};
const c = await chromium.launchPersistentContext('.scratch/ai-offline/profile', {
  serviceWorkers: 'block',
  viewport: { width: 1280, height: 900 },
});
await c.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }));
await c.route(origin + '/**', async (route) => {
  const response = await route.fetch();
  await route.fulfill({
    response,
    headers: {
      ...response.headers(),
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
    },
  });
});
const p = c.pages()[0] ?? (await c.newPage());
p.on('pageerror', (e) => report.errors.push(e.message));
p.on('console', (m) => {
  if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 1600));
});
const body = () => p.frameLocator('#app iframe').locator('body');
try {
  await p.goto(origin + '/');
  await p.evaluate(async () => {
    await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
  });
  await p.goto('about:blank');
  await p.goto(origin + '/editor?new=docx&agent=1&locale=en');
  await body().locator('.agent-sidebar-entry').click({ timeout: 90000 });
  await p.waitForFunction(
    () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
    null,
    { timeout: 180000 },
  );
  report.engine = await p.locator('.agent-model-status').textContent();
  if (!report.engine.includes('CPU') || !report.engine.includes('0.6B')) throw Error('Unexpected model');
  await body().evaluate((_el, source) => {
    const a = window.editor ?? window.Asc.editor;
    a.asc_EditSelectAll();
    a.pluginMethod_PasteText(source);
  }, source);
  await p.waitForFunction(
    (source) => {
      const a = document.querySelector('#app iframe')?.contentWindow?.editor;
      return a?.WordControl?.m_oLogicDocument?.GetText().trim() === source;
    },
    source,
    { timeout: 60000 },
  );
  const selected = await body().evaluate(() => {
    const a = window.editor ?? window.Asc.editor;
    a.asc_EditSelectAll();
    return a.pluginMethod_GetSelectedText();
  });
  await p.locator('.agent-writing-task').selectOption('summarize');
  await p.locator('.cui-input').fill('请用一句话忠实概括这段中文。');
  const started = Date.now();
  await p.locator('.cui-input').press('Enter');
  await p.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, null, { timeout: 60000 });
  report.responseMs = Date.now() - started;
  report.visibleErrors = await p.locator('.cui-msg-error').allTextContents();
  report.unchanged = await body().evaluate((_el, selected) => {
    const a = window.editor ?? window.Asc.editor;
    a.asc_EditSelectAll();
    return a.pluginMethod_GetSelectedText() === selected;
  }, selected);
  report.previewCount = await p.locator('.agent-plan-preview').count();
  if (
    !report.unchanged ||
    report.previewCount ||
    report.visibleErrors.length !== 1 ||
    !report.visibleErrors[0].startsWith('This request is too long. Select a shorter passage or split the task.')
  )
    throw Error('Context overflow did not preserve the document with actionable guidance');
  const beforeRestore = await p.locator('.cui-msg-user').count();
  await p.locator('.cui-msg-error .cui-restore').last().click();
  report.restore = {
    draft: await p.locator('.cui-input').inputValue(),
    userCount: await p.locator('.cui-msg-user').count(),
    running: await p.locator('.cui-input').isDisabled(),
  };
  if (
    report.restore.draft !== '请用一句话忠实概括这段中文。' ||
    report.restore.userCount !== beforeRestore ||
    report.restore.running
  )
    throw Error('Restore changed or executed the request');
  await body().evaluate(() => {
    const a = window.editor ?? window.Asc.editor;
    a.asc_EditSelectAll();
    a.pluginMethod_PasteText('Recovery document.');
  });
  await p.waitForFunction(
    () =>
      document.querySelector('#app iframe')?.contentWindow?.editor?.WordControl?.m_oLogicDocument?.GetText().trim() ===
      'Recovery document.',
    null,
    { timeout: 60000 },
  );
  await p.locator('.agent-writing-task').selectOption('chat');
  await p.locator('.cui-input').fill('Please reply with only hello.');
  await p.locator('.cui-input').press('Enter');
  await p.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, null, { timeout: 90000 });
  report.nextReply = await p.locator('.cui-msg-agent').last().getAttribute('data-source');
  report.errorCountAfterRecovery = await p.locator('.cui-msg-error').count();
  if (!report.nextReply?.trim() || report.errorCountAfterRecovery !== report.visibleErrors.length)
    throw Error('Model did not recover after context rejection');
  report.status = 'completed';
} catch (e) {
  report.status = 'failed';
  report.error = String(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile('docs/evaluations/2026-10-03-cpu-long-writing.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  await c.unrouteAll({ behavior: 'wait' });
  await c.close();
}
