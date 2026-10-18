import { mockApi, originalApiUrl } from './lib/mock-api';
import { readFile } from 'node:fs/promises';
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

test('attached reference excerpts reach only the explicitly selected AI service', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent_conversation_saving_v2', 'true');
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
  await mockApi(page, 'http://localhost:11434/api/**', async (route) => {
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
        json: { message: { role: 'assistant', content: 'I can read the attached notes. [S1]' }, done: true },
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
  const sourceSearch = page.getByRole('searchbox', { name: 'Search sources', exact: true });
  await sourceSearch.fill('only this');
  await page.locator('.agent-source-row summary').click();
  await expect(page.locator('.agent-source-preview mark')).toHaveText('Only this');
  await page.locator('.agent-source-row summary').click();
  await page.locator('.agent-source-row summary').click();
  await expect(page.locator('.agent-source-preview pre mark')).toHaveText('Only this');
  await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('source-search-preview.png') });
  await sourceSearch.fill('');
  expect(bodies).toEqual([]);
  await page.getByRole('button', { name: 'Back to conversation', exact: true }).click();
  await page.locator('.cui-input').fill('Hello');
  await page.locator('.cui-send').click();
  await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
  await page.locator('.cui-send').click();
  await expect(page.locator('.cui-msg-agent')).toContainText('I can read');
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toContain('Only this reference is attached.');
  await page.locator('.agent-sources-toggle').click();
  await page.getByRole('button', { name: 'Remove: notes.txt', exact: true }).click();
  await page.getByRole('button', { name: 'Back to conversation', exact: true }).click();
  await page.getByRole('button', { name: 'Open source: notes.txt', exact: true }).click();
  await expect(page.locator('.cui-bubble .agent-source-preview pre')).toContainText('Only this reference is attached.');
  await page.locator('.cui-bubble .agent-source-preview summary').click();
  await page.locator('.cui-bubble .agent-source-preview summary').click();
  await expect(page.locator('.cui-bubble .agent-source-preview pre')).toContainText('Only this reference is attached.');
  expect(bodies).toHaveLength(1);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.getByRole('button', { name: 'Open source: notes.txt', exact: true }).click();
  await expect(page.locator('.cui-bubble .agent-source-preview pre')).toContainText('Only this reference is attached.');
  expect(bodies).toHaveLength(1);
  await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('captured-source-citation.png') });
  const followUp = page.getByRole('button', { name: 'Summarize answer', exact: true });
  await expect(followUp).toBeVisible();
  await page.locator('.cui-input').fill('Keep this draft');
  await followUp.focus();
  await followUp.press('Enter');
  await expect(page.locator('.agent-result-choice')).toBeVisible();
  await page.setViewportSize({ width: 360, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('follow-up-choice-narrow.png') });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page
    .locator('.agent-runtime-panel')
    .screenshot({ path: testInfo.outputPath('follow-up-choice-narrow-dark.png') });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await expect(page.locator('.cui-input')).toHaveValue('Keep this draft');
  expect(bodies).toHaveLength(1);
  await page.getByRole('button', { name: 'Keep my draft', exact: true }).click();
  await expect(page.locator('.cui-input')).toHaveValue('Keep this draft');
  await followUp.click();
  await page.locator('.cui-input').focus();
  await page.locator('.cui-input').dispatchEvent('compositionstart');
  await page.getByRole('button', { name: 'Use suggestion', exact: true }).click();
  await expect(page.locator('.cui-input')).toHaveValue('Keep this draft');
  await expect(page.locator('.cui-input')).toBeFocused();
  await page.locator('.cui-input').dispatchEvent('compositionend');
  await page.getByRole('button', { name: 'Use suggestion', exact: true }).click();
  await expect(page.locator('.cui-input')).toHaveValue(
    /Summarize the following answer[\s\S]*I can read the attached notes/,
  );
  await expect(page.locator('.cui-input')).toBeFocused();
  expect(bodies).toHaveLength(1);
  await page.locator('.cui-save').click();
  await expect(page.locator('.agent-artifact-provenance')).toContainText('notes.txt');
  await page.locator('.agent-artifact-editor textarea').fill('Keep artifact draft');
  await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
  await expect(page.locator('.cui-save')).toHaveText('Saved');
  await page.locator('.cui-save').click();
  await expect(page.locator('.agent-artifact-status')).toContainText('Discard unsaved changes');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.agent-artifact-editor textarea')).toHaveValue('Keep artifact draft');
  await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
  await expect(page.locator('.cui-save')).toHaveText('Save as artifact');
  await page.setViewportSize({ width: 360, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() => page.locator('.cui-message-actions').evaluate((el) => el.scrollWidth - el.clientWidth))
    .toBeLessThan(2);
  expect(bodies).toHaveLength(1);
  await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('result-actions-narrow.png') });
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
  l0,
}, testInfo) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  });
  const connectorRequests: string[] = [];
  page.on('request', (request) => {
    const url = originalApiUrl(page, request.url());
    if (new URL(url).pathname.startsWith('/api/connectors/')) connectorRequests.push(url);
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
  // Cache inventory may probe an unprepared SDK while offline. WebKit emits
  // pageerror for these caught import rejections; correlate only exact optional
  // module failures, keeping prepared core and unrelated module failures fatal.
  const manifest = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const source = await (await fetch('/sw.js', { cache: 'no-store' })).text();
    return {
      core: JSON.parse(/const APP_ASSETS_TO_CACHE = (\[.*?\]);/.exec(source)![1]) as string[],
      capabilities: JSON.parse(/const ASSISTANT_CAPABILITY_ASSETS = (\{.*?\});/.exec(source)![1]) as Record<
        string,
        string[]
      >,
    };
  });
  const absolute = (path: string) => new URL(path, page.url()).href;
  const core = new Set(manifest.core.map(absolute));
  const optionalScripts = new Set(
    [...manifest.capabilities.webgpu, ...(manifest.capabilities.wllama || [])]
      .filter((path) => path.endsWith('.js'))
      .map(absolute),
  );
  const failedWhileOffline = new Set<string>();
  let offline = true;
  page.on('requestfailed', (request) => {
    if (offline) failedWhileOffline.add(originalApiUrl(page, request.url()));
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
  offline = false;
  await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
  await page.locator('.agent-sources-toggle').click();
  await expect(page.locator('.agent-cloud-sources')).toBeVisible();
  await expect(page.locator('.agent-source-row')).toContainText('offline.txt');
  expect(connectorRequests).toEqual([]);
  await page.getByRole('button', { name: 'Back to conversation', exact: true }).click();
  await expect(page.locator('.cui-input')).toHaveValue('Keep this draft offline');
  expect([...failedWhileOffline].filter((url) => core.has(url))).toEqual([]);
  expect(
    [...failedWhileOffline].filter((url) => new URL(url).pathname.startsWith('/assets/') && !optionalScripts.has(url)),
  ).toEqual([]);
  const loaderDiagnostics = /^(?:Response served by service worker is an error|Cannot load \.)$/;
  const diagnostics = l0.pageErrors.filter((message) => loaderDiagnostics.test(message));
  if (diagnostics.length) {
    const optionalFailures = [...failedWhileOffline].filter((url) => optionalScripts.has(url));
    expect(optionalFailures.length).toBeGreaterThan(0);
    expect(diagnostics.length).toBeLessThanOrEqual(2 * optionalFailures.length);
    l0.allowFrameError(loaderDiagnostics);
  }
});

test('expired Drive authorization and attachment limits expose usable recovery actions', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  });
  let reads = 0;
  await mockApi(page, '**/api/connectors/google/**', async (route) => {
    if (route.request().url().includes('/read')) {
      reads++;
      await route.fulfill({ status: 401, json: { error: 'reconnect_required' } });
    } else await route.fulfill({ json: { files: [{ id: 'policy', name: 'Policy' }], nextPageToken: 'next' } });
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-sources-toggle').click();
  const input = page.locator('.agent-sources-view input[type=file]');
  for (let i = 1; i <= 5; i++) {
    await input.setInputFiles({
      name: `note-${i}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('Local reference'),
    });
    await expect(page.locator('.agent-source-row')).toHaveCount(i);
  }
  await input.setInputFiles({ name: 'sixth.txt', mimeType: 'text/plain', buffer: Buffer.from('Sixth reference') });
  await expect(page.locator('.agent-sources-status')).toHaveText(
    'You can attach up to 5 sources. Remove one before adding another.',
  );
  await page.locator('.agent-source-row button').first().click();
  await input.setInputFiles({ name: 'sixth.txt', mimeType: 'text/plain', buffer: Buffer.from('Sixth reference') });
  await expect(page.locator('.agent-source-row')).toHaveCount(5);
  await expect(page.locator('.agent-sources-attached')).toContainText('sixth.txt');
  const cloud = page.locator('.agent-cloud-sources');
  const connect = cloud.getByRole('button', { name: 'Connect', exact: true });
  await cloud.getByRole('button', { name: 'Browse files', exact: true }).click();
  await expect(connect).toBeHidden();
  await cloud.getByRole('button', { name: 'Policy', exact: true }).click();
  await expect(page.locator('.agent-sources-status')).toContainText('Connect again');
  await expect(connect).toBeVisible();
  await expect(cloud.getByRole('button', { name: 'Policy', exact: true })).toHaveCount(0);
  await expect(cloud.getByRole('button', { name: 'Load more', exact: true })).toBeHidden();
  await expect(page.locator('.agent-source-row')).toHaveCount(5);
  expect(reads).toBe(1);
});

test('discard restores artifact titles and a full version history can continue as a new artifact', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
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
    const now = Date.now();
    const tx = db.transaction(['artifacts', 'summaries'], 'readwrite');
    tx.objectStore('artifacts').put({
      id: 'full-history',
      title: 'Saved title',
      updatedAt: now,
      versions: Array.from({ length: 20 }, (_, i) => ({ version: i + 1, text: `Version ${i + 1}`, createdAt: now })),
      provenance: { sources: [{ title: 'Policy', connector: 'local' }] },
    });
    tx.objectStore('summaries').put({ id: 'full-history', title: 'Saved title', updatedAt: now, version: 20 });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
  await page.getByRole('button', { name: 'Saved title', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'Title', exact: true });
  const text = page.locator('.agent-artifact-editor textarea');
  const versions = page.locator('.agent-artifact-editor select');
  await versions.selectOption('1');
  await title.fill('Unsaved title');
  await versions.selectOption('20');
  await page.locator('[data-action=discardChanges]').click();
  await expect(title).toHaveValue('Saved title');
  await expect(text).toHaveValue('Version 20');
  await expect(page.locator('[data-action=saveVersion]')).toBeDisabled();
  await text.fill('Continue this draft');
  await page.locator('[data-action=saveVersion]').click();
  await expect(page.locator('.agent-artifact-status')).toContainText('20 versions');
  await expect(text).toHaveValue('Continue this draft');
  await page.setViewportSize({ width: 360, height: 700 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('artifact-version-recovery.png') });
  await page.getByRole('button', { name: 'Save as new artifact', exact: true }).click();
  await expect(page.locator('.agent-artifact-status')).toHaveText('Saved on this device');
  await expect(versions.locator('option')).toHaveCount(1);
  await expect(text).toHaveValue('Continue this draft');
  await expect(page.locator('.agent-artifact-provenance')).toContainText('Policy');
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
  await expect(page.locator('.agent-artifacts-list li')).toHaveCount(2);
});

test('switching conversations releases a pending source read without attaching its late result', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  });
  let release!: () => void;
  let reading = false;
  const waitForRelease = new Promise<void>((resolve) => {
    release = resolve;
  });
  await mockApi(page, '**/api/connectors/google/**', async (route) => {
    if (route.request().url().includes('/read')) {
      reading = true;
      await waitForRelease;
      await route.fulfill({ json: { text: 'Old conversation private data' } });
    } else await route.fulfill({ json: { files: [{ id: 'old', name: 'Old policy' }] } });
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-sources-toggle').click();
  await page.getByRole('button', { name: 'Browse files', exact: true }).click();
  await page.getByRole('button', { name: 'Old policy', exact: true }).click();
  await expect.poll(() => reading).toBe(true);
  await page.locator('.agent-panel-clear').click();
  await page.locator('.agent-sources-toggle').click();
  await page
    .locator('.agent-sources-view input[type=file]')
    .setInputFiles({ name: 'fresh.txt', mimeType: 'text/plain', buffer: Buffer.from('New conversation data') });
  await expect(page.locator('.agent-source-row')).toHaveText('fresh.txtRemove');
  const completed = page.waitForResponse(
    (response) => new URL(originalApiUrl(page, response.url())).pathname === '/api/connectors/google/read',
  );
  release();
  await completed;
  await expect(page.locator('.agent-source-row')).toHaveText('fresh.txtRemove');
  await page.getByRole('button', { name: 'Back to conversation', exact: true }).click();
  await expect(page.locator('.agent-sources-summary')).toHaveText('fresh.txt');
});

test('structured results validate explicitly, preview compactly and export without a network', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/');
  // Measure the engine/platform's native filename policy separately from the
  // exact filename requested by the application (GTK WebKit replaces spaces).
  const nativeDownload = page.waitForEvent('download');
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['filename probe'], { type: 'text/csv;charset=utf-8' }));
    link.download = 'Release table.csv';
    document.body.append(link);
    link.click();
    link.remove();
  });
  const nativeFile = await nativeDownload;
  const nativeFilename = nativeFile.suggestedFilename();
  await nativeFile.delete();
  await page.addInitScript(() => {
    const host = window.top as Window & { __artifactDownloadNames?: string[] };
    host.__artifactDownloadNames ??= [];
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && this.href.startsWith('blob:')) host.__artifactDownloadNames!.push(this.download);
      return click.call(this);
    };
  });
  await page.evaluate(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'loopback',
        baseUrl: 'http://localhost:11434',
        model: 'structured-test',
        preference: 'device-first',
        localWritingConsent: false,
      }),
    );
  });
  let calls = 0;
  const requests: Record<string, unknown>[] = [];
  await mockApi(page, 'http://localhost:11434/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
      return;
    }
    if (route.request().url().endsWith('/tags')) {
      await route.fulfill({ json: { models: [{ name: 'structured-test' }] } });
      return;
    }
    requests.push(JSON.parse(route.request().postData()!));
    const result =
      ++calls === 1
        ? { kind: 'slides', slides: [{ title: 'Wrong kind', body: 'Rejected' }] }
        : {
            kind: 'table',
            columns: ['Name', 'Value'],
            rows: Array.from({ length: 25 }, (_, i) => [i === 0 ? 'AI row' : 'row ' + i, i === 0 ? '=1+1' : 'value']),
          };
    await route.fulfill({
      json: { message: { role: 'assistant', content: JSON.stringify(result) }, done: true, done_reason: 'stop' },
    });
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-panel-settings-toggle').click();
  await page.locator('.agent-panel-endpoint-connect').click();
  await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
  await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
  await page.getByRole('button', { name: 'Import structured result', exact: true }).click();
  await page.locator('.agent-artifact-editor input').fill('Release table');
  const payload = {
    kind: 'table',
    columns: ['Name', 'Value'],
    rows: Array.from({ length: 25 }, (_, i) => ['row ' + i, i === 0 ? '=1+1' : 'value']),
  };
  await page.locator('.agent-artifact-editor textarea').fill(JSON.stringify({ schemaVersion: 1, payload }));
  await page.getByRole('button', { name: 'Save as new artifact', exact: true }).click();
  await expect(page.locator('.agent-artifact-data-preview table tr')).toHaveCount(11);
  await expect(page.getByRole('button', { name: 'Review in document', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Refine with AI', exact: true }).click();
  await page.getByRole('textbox', { name: 'Describe the change…', exact: true }).fill('Rename the first row');
  await page.getByRole('button', { name: 'Suggest changes', exact: true }).click();
  await expect(page.locator('.agent-artifact-workflow')).toContainText('The revision could not finish');
  await expect(page.getByRole('button', { name: 'Use in draft', exact: true })).toBeHidden();
  await expect(page.locator('.agent-artifact-data-preview td textarea').first()).toHaveValue('row 0');
  await page.getByRole('button', { name: 'Suggest changes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Use in draft', exact: true })).toBeVisible();
  expect(JSON.stringify(requests[1])).toContain('10000 cells');
  expect(requests[1].tools ?? []).toEqual([]);
  await page.getByRole('button', { name: 'Use in draft', exact: true }).click();
  await expect(page.locator('.agent-artifact-data-preview td textarea').first()).toHaveValue('AI row');
  await expect(page.locator('.agent-artifact-editor select option')).toHaveCount(1);
  await page.getByRole('button', { name: 'Save version', exact: true }).click();
  await expect(page.locator('.agent-artifact-editor select option')).toHaveCount(2);
  for (const theme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width: 360, height: 760 });
    await page.emulateMedia({ colorScheme: theme });
    await page.locator('.agent-artifact-editor > input').scrollIntoViewIfNeeded();
    await page
      .locator('.agent-runtime-panel')
      .screenshot({ path: testInfo.outputPath(`structured-default-${theme}.png`) });
  }
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.locator('.agent-artifact-data-preview tbody textarea, .agent-artifact-data-preview tr textarea').nth(2),
  ).toHaveValue('row 10');
  await context.setOffline(true);
  await page.getByText('Export', { exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await download;
  expect(
    await page.evaluate(() => (window as Window & { __artifactDownloadNames?: string[] }).__artifactDownloadNames),
  ).toEqual(['Release table.csv']);
  expect(file.suggestedFilename()).toBe(nativeFilename);
  const exported = await readFile((await file.path())!, 'utf8');
  const rows = exported.split('\r\n');
  expect(rows).toHaveLength(26);
  expect(rows[0]).toBe('"Name","Value"');
  expect(rows[1]).toBe('"AI row","\'=1+1"');
  expect(rows.at(-1)).toBe('"row 24","value"');
  for (const theme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width: 360, height: 760 });
    await page.emulateMedia({ colorScheme: theme });
    await expect
      .poll(() => page.locator('.agent-runtime-panel').evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThan(2);
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`structured-${theme}.png`) });
  }
  await page.locator('.agent-artifacts').getByRole('button', { name: 'Back to artifacts', exact: true }).click();
  await page.getByRole('button', { name: 'Import structured result', exact: true }).click();
  await page.locator('.agent-artifact-editor input').fill('Release slides');
  await page.locator('.agent-artifact-editor textarea').fill(
    JSON.stringify({
      schemaVersion: 1,
      payload: {
        kind: 'slides',
        slides: [
          { title: 'Release summary', body: 'A concise update for the team.' },
          { title: 'Next steps', body: 'Review and publish.' },
        ],
      },
    }),
  );
  await page.getByRole('button', { name: 'Save as new artifact', exact: true }).click();
  const slideBody = page.locator('.agent-artifact-data-preview > textarea').nth(1);
  await slideBody.focus();
  await slideBody.press('End');
  await slideBody.press('!');
  await expect(slideBody).toBeFocused();
  await page.getByRole('button', { name: 'Save version', exact: true }).click();
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.locator('.agent-artifact-editor > input').scrollIntoViewIfNeeded();
    await expect
      .poll(() => page.locator('.agent-runtime-panel').evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThan(2);
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`slides-default-${theme}.png`) });
  }
  await context.setOffline(false);
});
