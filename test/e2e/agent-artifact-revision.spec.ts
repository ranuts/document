import { expect, test } from './lib/l0';

test('artifact AI revisions stay in an explicit draft review and preserve newer edits', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/');
  const artifactId = await page.evaluate(async () => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'loopback',
        baseUrl: 'http://localhost:11434',
        model: 'artifact-test',
        preference: 'device-first',
        localWritingConsent: false,
      }),
    );
    const id = crypto.randomUUID();
    const opening = indexedDB.open('document-ai-artifacts', 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore('artifacts', { keyPath: 'id' });
      opening.result.createObjectStore('summaries', { keyPath: 'id' });
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    const tx = db.transaction(['artifacts', 'summaries'], 'readwrite');
    tx.objectStore('artifacts').put({
      id,
      title: 'Release draft',
      updatedAt: Date.now(),
      versions: [{ version: 1, text: '前😀selected后', createdAt: Date.now() }],
      provenance: { sources: [{ title: 'Original notes', connector: 'local' }] },
    });
    tx.objectStore('summaries').put({ id, title: 'Release draft', updatedAt: Date.now(), version: 1 });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return id;
  });
  const requests: Array<Record<string, unknown>> = [];
  let delayed = false,
    release: () => void = () => {};
  await page.route('http://localhost:11434/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
      return;
    }
    if (route.request().url().endsWith('/tags')) {
      await route.fulfill({ json: { models: [{ name: 'artifact-test' }] } });
      return;
    }
    requests.push(JSON.parse(route.request().postData()!));
    if (delayed)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route
      .fulfill({
        json: {
          message: { role: 'assistant', content: requests.length === 1 ? '新' : 'Full revised artifact' },
          done: true,
          done_reason: 'stop',
        },
      })
      .catch(() => {});
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-panel-settings-toggle').click();
  await page.locator('.agent-panel-endpoint-connect').click();
  await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
  await page.locator('.agent-workspace-toggle').click();
  await page.locator(`[data-artifact="${artifactId}"]`).click();
  const text = page.locator('.agent-artifact-editor > textarea');
  await text.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(3, 11);
  });
  await page.getByRole('button', { name: 'Refine with AI', exact: true }).click();
  const instruction = page.getByRole('textbox', { name: 'Describe the change…', exact: true });
  await expect(page.locator('.agent-artifact-scope')).toHaveText('Selected text · 8 characters');
  await instruction.fill('Shorten this selection');
  await instruction.dispatchEvent('compositionstart');
  await instruction.press('Enter');
  await page.locator('.agent-artifact-workflow form').evaluate((el: HTMLFormElement) => el.requestSubmit());
  expect(requests).toHaveLength(0);
  await instruction.dispatchEvent('compositionend');
  await page.getByRole('button', { name: 'Suggest changes', exact: true }).click();
  await expect(page.locator('.agent-artifact-diff ins')).toHaveText('新');
  await expect(text).toHaveValue('前😀selected后');
  const payload = JSON.stringify(requests[0]);
  expect(payload).toContain('selectedText');
  expect(payload).not.toContain('前😀selected后');
  expect(requests[0].tools ?? []).toEqual([]);
  await page.setViewportSize({ width: 360, height: 700 });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect
      .poll(() => page.locator('.agent-runtime-panel').evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThan(2);
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`revision-${theme}.png`) });
  }
  await page.getByRole('button', { name: 'Use in draft', exact: true }).click();
  await expect(text).toHaveValue('前😀新后');
  await expect(page.locator('.agent-artifact-editor select option')).toHaveCount(1);
  await page.getByRole('button', { name: 'Save version', exact: true }).click();
  await expect(page.locator('.agent-artifact-editor select option')).toHaveCount(2);
  // Collapsed selection means a full-artifact revision. Editing during inference
  // cancels that owner; its eventual response cannot wipe the new draft.
  await page.getByRole('button', { name: 'Refine with AI', exact: true }).click();
  await text.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
  await expect(page.locator('.agent-artifact-scope')).toHaveText('Entire artifact');
  await instruction.fill('Revise the whole artifact');
  delayed = true;
  await page.getByRole('button', { name: 'Suggest changes', exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(JSON.stringify(requests[1])).toContain('前😀新后');
  await text.fill('My newer draft');
  release();
  await expect(text).toHaveValue('My newer draft');
  await expect(page.getByRole('button', { name: 'Use in draft', exact: true })).toBeHidden();
  // Stop is explicit and keeps the instruction/draft even if the service ignores abort.
  await instruction.fill('Stopped request');
  await page.getByRole('button', { name: 'Suggest changes', exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  const releaseStopped = release;
  await page.locator('.agent-artifact-workflow [data-action=stop]').click();
  await expect(page.locator('.agent-artifact-workflow [role=status]')).toHaveText('Stopped.');
  await expect(instruction).toHaveValue('Stopped request');
  releaseStopped();
  await expect(text).toHaveValue('My newer draft');
  await expect(page.getByRole('button', { name: 'Use in draft', exact: true })).toBeHidden();
  // A second tab writing a version makes Save fail with a direct safe recovery.
  await page.evaluate(async (id) => {
    const r = indexedDB.open('document-ai-artifacts', 1);
    const db = await new Promise<IDBDatabase>((resolve) => {
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction(['artifacts', 'summaries'], 'readwrite');
    const get = tx.objectStore('artifacts').get(id);
    get.onsuccess = () => {
      const a = get.result;
      a.versions.push({ version: 3, text: 'Other writer', createdAt: Date.now() });
      tx.objectStore('artifacts').put(a);
      tx.objectStore('summaries').put({ id, title: a.title, updatedAt: Date.now(), version: 3 });
    };
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, artifactId);
  await page.getByRole('button', { name: 'Save version', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save as new artifact', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save as new artifact', exact: true }).click();
  await expect(text).toHaveValue('My newer draft');
  await expect(page.locator('.agent-artifact-editor select option')).toHaveCount(1);
  await expect(page.locator('.agent-artifact-provenance')).toContainText('Original notes');
});
