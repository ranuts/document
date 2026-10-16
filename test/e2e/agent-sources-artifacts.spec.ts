import { expect, test } from './lib/l0';

test('local sources and versioned artifacts remain explicit, compact and reviewed', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const source = '# Release note\n\nA concise draft for review.';
  await page.goto('/');
  await page.evaluate(async (body) => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
    localStorage.setItem('agent_conversation_saving_v2', 'true');
    const id = crypto.randomUUID();
    const now = Date.now();
    const request = indexedDB.open('document-ai-conversations', 2);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('conversations');
      request.result.createObjectStore('sessions');
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['conversations', 'sessions'], 'readwrite');
    tx.objectStore('conversations').put({ version: 2, revision: 1, activeId: id, sessionIds: [id] }, 'state');
    tx.objectStore('sessions').put(
      {
        id,
        title: 'Project update',
        createdAt: now,
        updatedAt: now,
        messages: [
          { role: 'user', content: 'Draft a short project update.' },
          { role: 'assistant', content: body, documentArtifact: true, copyOnly: true },
          { role: 'user', content: 'Expand the closing paragraph.' },
          { role: 'assistant', content: 'The follow-up response was interrupted', interrupted: true },
        ],
      },
      id,
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, source);
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await expect(page.locator('.cui-save')).toHaveCount(1);
  await page.locator('.agent-sources-toggle').click();
  await page
    .locator('.agent-sources-view input[type=file]')
    .setInputFiles({ name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('Project reference') });
  await expect(page.locator('.agent-source-row')).toContainText('notes.md');
  await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('sources.png') });
  await page.getByRole('button', { name: 'Back to conversation', exact: true }).click();
  await expect(page.locator('.agent-sources-summary')).toHaveText('notes.md');
  await page.locator('.cui-save').click();
  await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'artifacts');
  const text = page.locator('.agent-artifact-editor textarea');
  await expect(text).toHaveValue(source);
  await text.fill('Edited release note');
  await page.getByRole('button', { name: 'Save version', exact: true }).click();
  await expect(page.locator('.agent-artifact-status')).toHaveText('Saved on this device');
  await expect(page.locator('.agent-artifact-editor select option')).toHaveCount(2);
  await page.locator('.agent-artifact-editor select').selectOption('1');
  await expect(text).toHaveValue(source);
  await page.getByRole('button', { name: 'Save version', exact: true }).click();
  await expect(page.locator('.agent-artifact-editor select option')).toHaveCount(3);
  await page.setViewportSize({ width: 360, height: 700 });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect
      .poll(() => page.locator('.agent-runtime-panel').evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThan(2);
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`artifacts-${theme}.png`) });
  }
  await page.getByRole('button', { name: 'Review in document', exact: true }).click();
  await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
  await expect(page.locator('.agent-plan-preview')).toBeVisible();
  await expect(page.locator('.agent-plan-preview')).toContainText('Release note');
});

test('attached reference excerpts reach only the explicitly selected AI service', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'loopback',
        baseUrl: 'http://localhost:11434',
        model: 'source-test',
        preference: 'device-first',
        localWritingConsent: false,
      }),
    );
  });
  const bodies: string[] = [];
  await page.route('http://localhost:11434/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
      return;
    }
    if (route.request().url().endsWith('/tags')) await route.fulfill({ json: { models: [{ name: 'source-test' }] } });
    else {
      bodies.push(route.request().postData() ?? '');
      await route.fulfill({
        json: { message: { role: 'assistant', content: 'I can read the attached notes.' }, done: true },
      });
    }
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-sources-toggle').click();
  await page.locator('.agent-sources-view input[type=file]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Only this reference is attached.'),
  });
  await expect(page.locator('.agent-source-row')).toContainText('notes.txt');
  expect(bodies).toEqual([]);
  await page.getByRole('button', { name: 'Back to conversation', exact: true }).click();
  await page.locator('.cui-input').fill('Hello');
  await page.locator('.cui-send').click();
  await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
  await page.locator('.cui-send').click();
  await expect(page.locator('.cui-msg-agent')).toContainText('I can read');
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toContain('Only this reference is attached.');
  await page.locator('.cui-save').click();
  await expect(page.locator('.agent-artifact-provenance')).toContainText('notes.txt');
});

test('cloud model settings exclude browser runtime configuration and cache hints', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    const baseUrl = 'https://assistant.example.invalid/v1';
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem(`agent_endpoint_key_${encodeURIComponent(baseUrl)}`, 'test-only-key');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'openai-compatible',
        baseUrl,
        model: 'test',
        preference: 'device-first',
        localWritingConsent: false,
      }),
    );
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-panel-settings-toggle').click();
  await page.locator('.agent-preferences summary').click();
  await expect(page.locator('.agent-service-section')).toBeVisible();
  await expect(page.locator('.agent-panel-provider')).toBeHidden();
  await expect(page.locator('.agent-panel-local-writing-label')).toBeHidden();
  await expect(page.locator('.agent-write-preference')).toBeHidden();
  await expect(page.locator('.agent-custom-sources')).toBeHidden();
  await expect(page.locator('.agent-device-section')).toBeHidden();
  await expect(page.locator('.agent-panel-note')).toBeHidden();
  await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('cloud-settings.png') });
});

test('offline workspace hides cloud discovery and download controls while retaining local work without automatic reconnect', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  });
  const connectorRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/connectors/')) connectorRequests.push(request.url());
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
  await page.locator('.cui-input').fill('Keep this draft offline');
  await page.evaluate(async () => {
    const request = indexedDB.open('document-ai-artifacts', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('artifacts', { keyPath: 'id' });
      request.result.createObjectStore('summaries', { keyPath: 'id' });
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['artifacts', 'summaries'], 'readwrite');
    const now = Date.now();
    tx.objectStore('artifacts').put({
      id: 'offline-draft',
      title: 'Offline draft',
      updatedAt: now,
      versions: [{ version: 1, text: 'Editable offline', createdAt: now }],
      provenance: {},
    });
    tx.objectStore('summaries').put({ id: 'offline-draft', title: 'Offline draft', updatedAt: now, version: 1 });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await context.setOffline(true);
  await page.locator('.agent-sources-toggle').click();
  await expect(page.locator('.agent-cloud-sources')).toBeHidden();
  await expect(page.locator('.agent-sources-view .agent-offline-hint')).toBeVisible();
  await expect(page.locator('.agent-source-settings')).toBeVisible();
  await page.locator('.agent-sources-view input[type=file]').setInputFiles({
    name: 'offline.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Available without a network.'),
  });
  await expect(page.locator('.agent-source-row')).toContainText('offline.txt');
  await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('sources-offline.png') });
  await page.getByRole('button', { name: 'Back to conversation', exact: true }).click();
  await expect(page.locator('.agent-sources-summary')).toHaveText('offline.txt');
  await page.locator('.agent-panel-settings-toggle').click();
  await expect(page.locator('.agent-panel-settings > .agent-offline-hint')).toBeVisible();
  await expect(page.locator('.agent-model-choice')).toBeHidden();
  await expect(page.locator('.agent-panel-load')).toBeHidden();
  await page.locator('.agent-preferences summary').click();
  await expect(page.locator('.agent-panel-provider')).toBeVisible();
  await expect(page.locator('.agent-custom-sources')).toBeHidden();
  await expect(page.locator('.agent-model-cache')).toBeVisible();
  await page.locator('.agent-panel-settings-toggle').click();
  await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
  await expect(page.locator('.agent-artifacts')).toBeVisible();
  await page.getByRole('button', { name: 'Offline draft', exact: true }).click();
  await page.locator('.agent-artifact-editor textarea').fill('Saved without a network');
  await page.getByRole('button', { name: 'Save version', exact: true }).click();
  await expect(page.locator('.agent-artifact-editor select option')).toHaveCount(2);
  await expect(page.locator('.agent-artifact-status')).toHaveText('Saved on this device');
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
  await page.locator('.agent-sources-toggle').click();
  await expect(page.locator('.agent-cloud-sources')).toBeVisible();
  await expect(page.locator('.agent-source-row')).toContainText('offline.txt');
  expect(connectorRequests).toEqual([]);
  await page.getByRole('button', { name: 'Back to conversation', exact: true }).click();
  await expect(page.locator('.cui-input')).toHaveValue('Keep this draft offline');
});
