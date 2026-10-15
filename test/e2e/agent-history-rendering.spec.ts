import { expect, test } from './lib/l0';

test('restores a long saved conversation and switches sessions with completed answer actions', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const ids = await page.evaluate(async () => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
    localStorage.setItem('agent_conversation_saving_v2', 'true');
    const long = crypto.randomUUID();
    const short = crypto.randomUUID();
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
    tx.objectStore('conversations').put(
      { version: 2, revision: 1, activeId: long, sessionIds: [long, short] },
      'state',
    );
    const messages = Array.from({ length: 200 }, (_, index) => [
      { role: 'user', content: `Question ${index}` },
      { role: 'assistant', content: `**Answer ${index}**` },
    ]).flat();
    tx.objectStore('sessions').put({ id: long, title: 'Long history', createdAt: now, updatedAt: now, messages }, long);
    tx.objectStore('sessions').put(
      {
        id: short,
        title: 'Short history',
        createdAt: now,
        updatedAt: now,
        messages: [
          { role: 'user', content: 'Short request' },
          { role: 'assistant', content: 'Short answer' },
        ],
      },
      short,
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return { long, short };
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  const rows = page.locator('.cui-messages .cui-msg');
  const loadAllEarlier = async () => {
    const earlier = page.getByRole('button', { name: 'Load earlier messages', exact: true });
    while (await earlier.isVisible()) await earlier.click();
  };
  await expect(rows).toHaveCount(40);
  await expect(rows.first().locator('.cui-bubble')).toHaveText('Question 180');
  await expect(rows.last().locator('.cui-copy')).toBeEnabled();
  await expect
    .poll(() =>
      page
        .locator('.cui-messages')
        .evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop),
    )
    .toBeLessThanOrEqual(2);
  const earlier = page.getByRole('button', { name: 'Load earlier messages', exact: true });
  await earlier.focus();
  await page.keyboard.press('Enter');
  await expect(rows).toHaveCount(80);
  await expect(earlier).toBeFocused();
  await loadAllEarlier();
  await expect(page.locator('.cui-messages')).toBeFocused();
  await expect(rows).toHaveCount(400);
  await expect(rows.first().locator('.cui-bubble')).toHaveText('Question 0');
  await expect(rows.last().locator('.cui-bubble strong')).toHaveText('Answer 199');
  await expect(rows.last().locator('.cui-copy')).toBeEnabled();
  await page.locator('.agent-history-toggle').click();
  const search = page.getByRole('searchbox', { name: 'Search conversations' });
  await search.fill('Short answer');
  await expect(page.locator('.agent-conversation-open')).toHaveCount(1);
  await search.fill('No matching request');
  await expect(page.locator('.agent-history-empty')).toBeVisible();
  await search.fill('');
  await expect(page.locator('.agent-history-management')).not.toHaveAttribute('open', '');
  await page.locator(`.agent-conversation-open[data-id="${ids.short}"]`).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.last().locator('.cui-bubble')).toHaveText('Short answer');
  await page.locator('.agent-history-toggle').click();
  await page.locator(`.agent-conversation-open[data-id="${ids.long}"]`).click();
  await expect(rows).toHaveCount(40);
  await loadAllEarlier();
  await expect(rows).toHaveCount(400);
  await expect(rows.last()).toHaveAttribute('data-source', '**Answer 199**');
  await page.locator('.cui-input').fill('Next request');
  await expect(page.locator('.cui-input')).toHaveValue('Next request');
  await page.locator('.agent-history-toggle').click();
  const history = page.locator('.agent-history-view');
  const titleBox = await history.locator('.agent-history-heading').boundingBox();
  const headerBox = await page.locator('.agent-runtime-panel .agent-panel-title').boundingBox();
  expect(Math.abs(titleBox!.x - headerBox!.x)).toBeLessThanOrEqual(1);
  const rowBox = await history.locator('.agent-conversation-title').first().boundingBox();
  expect(Math.abs(titleBox!.x - rowBox!.x)).toBeLessThanOrEqual(1);
  await page.locator('.agent-runtime-panel').screenshot({ path: test.info().outputPath('history-light.png') });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.locator('.agent-runtime-panel').screenshot({ path: test.info().outputPath('history-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 360, height: 640 });
  await expect.poll(() => history.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.locator('.agent-runtime-panel').screenshot({ path: test.info().outputPath('history-narrow.png') });
  await page.setViewportSize({ width: 1280, height: 900 });
  const inactiveDelete = page.locator(`.agent-conversation-delete[data-id="${ids.short}"]`);
  await inactiveDelete.click();
  await expect(page.locator('.agent-history-confirmation')).toBeVisible();
  await expect(page.locator('.agent-history-cancel')).toBeFocused();
  await expect(page.locator('.agent-history-confirmation')).toContainText('Short history');
  await page.keyboard.press('Escape');
  await expect(history).toBeVisible();
  await expect(inactiveDelete).toBeFocused();
  await expect(page.locator('.agent-conversation-open')).toHaveCount(2);
  await inactiveDelete.click();
  await page.locator('.agent-history-confirm').click();
  await expect(page.locator('.agent-conversation-open')).toHaveCount(1);
  await expect(search).toBeFocused();
  await expect(page.locator('.agent-conversation-open')).toHaveAttribute('data-id', ids.long);
  await page.keyboard.press('Escape');
  await expect(rows).toHaveCount(40);
  await loadAllEarlier();
  await expect(rows).toHaveCount(400);
  await expect(page.locator('.cui-input')).toHaveValue('Next request');
});

test('pages and searches one thousand saved conversations without cloning or reposting the corpus', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const metrics = { messageArrayClones: 0, corpusPosts: 0 };
    Object.defineProperty(window, '__historySearchMetrics', { value: metrics });
    const clone = window.structuredClone;
    window.structuredClone = (value, options) => {
      if (Array.isArray(value) && value.some((message) => message && typeof message === 'object' && 'role' in message))
        metrics.messageArrayClones++;
      return clone(value, options);
    };
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, options) {
      if (message?.type === 'update') metrics.corpusPosts++;
      return Reflect.apply(post, this, options === undefined ? [message] : [message, options]);
    };
  });
  await page.goto('/');
  const ids = await page.evaluate(async () => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
    localStorage.setItem('agent_conversation_saving_v2', 'true');
    const ids = Array.from({ length: 1000 }, () => crypto.randomUUID());
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
    tx.objectStore('conversations').put({ version: 2, revision: 1, activeId: ids[0], sessionIds: ids }, 'state');
    ids.forEach((id, index) =>
      tx.objectStore('sessions').put(
        {
          id,
          title: `Saved conversation ${index}`,
          createdAt: now - index * 1000,
          updatedAt: now - index * 1000,
          messages: Array.from({ length: 8 }, (_, message) => ({
            role: message % 2 ? 'assistant' : 'user',
            content:
              `${message === 7 ? `needle stored in message ${index}` : `Conversation ${index} message ${message}`}`.padEnd(
                512,
                'x',
              ),
          })),
        },
        id,
      ),
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return { active: ids[0], late: ids[997] };
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.cui-input').fill('Keep this draft');
  await page.locator('.agent-history-toggle').click();
  const rows = page.locator('.agent-conversation-open');
  await expect(rows).toHaveCount(40);
  await expect(page.locator(`.agent-conversation-open[data-id="${ids.active}"]`)).toHaveAttribute(
    'aria-current',
    'true',
  );
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(rows).toHaveCount(80);
  const search = page.getByRole('searchbox', { name: 'Search conversations' });
  await search.fill('needle stored in message 997');
  await expect(rows).toHaveCount(1);
  await expect(rows).toHaveAttribute('data-id', ids.late);
  await expect(rows.locator('.agent-conversation-snippet')).toContainText('needle stored in message 997');
  const before = await page.evaluate(() => ({
    ...(window as unknown as { __historySearchMetrics: { messageArrayClones: number; corpusPosts: number } })
      .__historySearchMetrics,
  }));
  await search.fill('needle stored in message 998');
  await expect(rows).toHaveCount(1);
  await expect(rows.locator('.agent-conversation-snippet')).toContainText('needle stored in message 998');
  await search.fill('needle stored in message 997');
  await expect(rows).toHaveAttribute('data-id', ids.late);
  const after = await page.evaluate(() => ({
    ...(window as unknown as { __historySearchMetrics: { messageArrayClones: number; corpusPosts: number } })
      .__historySearchMetrics,
  }));
  expect(after.messageArrayClones - before.messageArrayClones).toBe(0);
  expect(after.corpusPosts - before.corpusPosts).toBe(0);
  await search.fill('');
  await expect(rows).toHaveCount(40);
  await expect(page.locator(`.agent-conversation-open[data-id="${ids.active}"]`)).toHaveAttribute(
    'aria-current',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.cui-input')).toHaveValue('Keep this draft');
});

test('keeps the first validating request in its original chat while startup history restores', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent_conversation_saving_v2', 'true');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({ version: 1, kind: 'loopback', baseUrl: 'http://localhost:11434', model: 'startup-test' }),
    );
    const request = indexedDB.open('document-ai-conversations', 2);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('conversations');
      request.result.createObjectStore('sessions');
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const id = crypto.randomUUID();
    const tx = db.transaction(['conversations', 'sessions'], 'readwrite');
    tx.objectStore('conversations').put({ version: 2, revision: 1, activeId: id, sessionIds: [id] }, 'state');
    tx.objectStore('sessions').put(
      {
        id,
        title: 'Saved earlier chat',
        createdAt: 1,
        updatedAt: 1,
        messages: [{ role: 'user', content: 'Saved earlier chat' }],
      },
      id,
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    const success = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'onsuccess')!;
    const host = window as unknown as { releaseAssistantHistory?: () => void };
    let delayed = false;
    indexedDB.open = (...args: Parameters<IDBFactory['open']>) => {
      const request = open(...args);
      if (args[0] === 'document-ai-conversations' && !delayed) {
        delayed = true;
        Object.defineProperty(request, 'onsuccess', {
          set(callback: ((this: IDBRequest, event: Event) => void) | null) {
            success.set!.call(
              request,
              callback &&
                function (event: Event) {
                  host.releaseAssistantHistory = () => callback.call(request, event);
                },
            );
          },
          get: () => success.get!.call(request),
        });
      }
      return request;
    };
  });
  let releaseRouting: (() => void) | undefined;
  await page.route('http://localhost:11434/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
      return;
    }
    if (route.request().url().endsWith('/tags')) {
      await route.fulfill({ json: { models: [{ name: 'startup-test' }] } });
      return;
    }
    const body = route.request().postDataJSON();
    if (body.format?.properties?.task) {
      await new Promise<void>((resolve) => {
        releaseRouting = resolve;
      });
      await route.fulfill({
        json: { done: true, message: { role: 'assistant', content: '{"task":"chat","language":"en"}' } },
      });
      return;
    }
    await route.fulfill({
      json: { done: true, message: { role: 'assistant', content: 'The first request completed.' } },
    });
  });
  try {
    await page.goto('/editor?new=docx&locale=en');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
    const input = page.locator('.cui-input');
    await input.fill('Tell me a brief story');
    await page.locator('.cui-send').click();
    await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
    await page.locator('.cui-send').click();
    await expect.poll(() => typeof releaseRouting).toBe('function');
    await expect(page.locator('.agent-queue-text')).toHaveText('Tell me a brief story');
    await expect(page.locator('.agent-queue-state')).toHaveText('Preparing your request…');
    for (const action of ['edit', 'remove', 'send-now'])
      await expect(page.locator(`.agent-queue-${action}`)).toBeDisabled();
    await expect(page.locator('.cui-stop')).toBeEnabled();
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { releaseAssistantHistory?: () => void }).releaseAssistantHistory === 'function',
    );
    await page.evaluate(() => (window as unknown as { releaseAssistantHistory(): void }).releaseAssistantHistory());
    await expect(page.locator('.agent-history-status')).toContainText('saving is enabled');
    await expect(page.locator('.agent-queue-text')).toHaveText('Tell me a brief story');
    await expect(page.locator('.cui-msg-user')).toHaveCount(0);
    releaseRouting!();
    await expect(page.locator('.cui-msg-user')).toHaveText('Tell me a brief story');
    await expect(page.locator('.cui-msg-agent')).toContainText('The first request completed.');
    await expect(page.locator('.cui-msg-user')).toHaveCount(1);
  } finally {
    releaseRouting?.();
  }
});
