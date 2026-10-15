import { expect, test } from './lib/l0';

test('a held request shows actual classification and generation, then clears waiting on completion and Stop', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() =>
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'loopback',
        baseUrl: 'http://localhost:11434',
        model: 'feedback-test',
        preference: 'device-first',
        localWritingConsent: false,
      }),
    ),
  );
  let releaseRouting!: () => void;
  const routingGate = new Promise<void>((resolve) => (releaseRouting = resolve));
  let releaseAnswer!: () => void;
  const answerGate = new Promise<void>((resolve) => (releaseAnswer = resolve));
  let releaseStopped!: () => void;
  const stoppedGate = new Promise<void>((resolve) => (releaseStopped = resolve));
  let classifications = 0;
  let answers = 0;
  await page.route('http://localhost:11434/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
      return;
    }
    if (route.request().url().endsWith('/tags')) {
      await route.fulfill({ json: { models: [{ name: 'feedback-test' }] } });
      return;
    }
    const routing = !!route.request().postDataJSON().format?.properties?.task;
    if (routing && ++classifications === 1) await routingGate;
    const answer = routing ? 0 : ++answers;
    if (!routing) {
      if (answer === 1) await answerGate;
      if (answer === 2) await stoppedGate;
    }
    await route.fulfill({
      json: {
        done: true,
        message: {
          role: 'assistant',
          content: routing ? JSON.stringify({ task: 'chat', language: 'en' }) : `Useful answer ${answer}`,
        },
      },
    });
  });
  try {
    await page.goto('/editor?new=docx&locale=en');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.evaluate(() => window.__toggleAgentPanel?.());
    await page.locator('.agent-enable-switch').click();
    const input = page.locator('.cui-input');
    const send = page.locator('.cui-send');
    await input.fill('Explain what you can do with this document.');
    await send.click();
    await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
    await expect(send).toHaveAccessibleName('Send');
    await send.click();
    await expect.poll(() => classifications).toBe(1);
    const phase = page.locator('.cui-status');
    const elapsed = page.locator('.cui-elapsed');
    await expect(phase).toHaveText('Understanding your request…');
    await expect(page.locator('.cui-progress')).toBeVisible();
    await expect(elapsed).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(async () => Number.parseInt((await elapsed.textContent())!, 10)).toBeGreaterThan(0);
    const previousSeconds = Number.parseInt((await elapsed.textContent())!, 10);
    await input.fill('Next question');
    const before = (await page.locator('.cui-composer').boundingBox())!;
    await expect(input).toBeFocused();
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('process-routing-light.png') });
    releaseRouting();
    await expect.poll(() => answers).toBe(1);
    await expect(phase).toHaveText('Generating a response…');
    expect(Number.parseInt((await elapsed.textContent())!, 10)).toBeGreaterThanOrEqual(previousSeconds);
    const after = (await page.locator('.cui-composer').boundingBox())!;
    expect(Math.abs(before.y - after.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(before.height - after.height)).toBeLessThanOrEqual(1);
    await page
      .locator('.agent-runtime-panel')
      .screenshot({ path: testInfo.outputPath('process-generating-light.png') });
    await page.evaluate(() => document.documentElement.setAttribute('data-ran-theme', 'dark'));
    await page.getByRole('separator', { name: 'Resize AI panel' }).press('Home');
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('process-generating-dark.png') });
    await page.setViewportSize({ width: 360, height: 640 });
    await expect
      .poll(() => page.locator('.agent-runtime-panel').evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThan(2);
    await page
      .locator('.agent-runtime-panel')
      .screenshot({ path: testInfo.outputPath('process-generating-narrow.png') });
    releaseAnswer();
    await expect(page.locator('.cui-msg-agent .cui-bubble')).toHaveText('Useful answer 1');
    await expect(page.locator('.cui-progress')).toBeHidden();
    await expect(elapsed).toHaveText('');
    await expect(input).toHaveValue('Next question');
    await send.click();
    await expect.poll(() => answers).toBe(2);
    await input.fill('One more question');
    await page.locator('.cui-send-stop').click();
    await expect(page.locator('.cui-progress')).toBeHidden();
    await expect(elapsed).toHaveText('');
    await expect(input).toHaveValue('One more question');
    await expect(send).toHaveAccessibleName('Send');
    releaseStopped();
    await send.click();
    await expect(page.getByRole('log')).toContainText('Useful answer 3');
    await expect(page.getByRole('log')).not.toContainText('Useful answer 2');
    await expect(page.locator('.cui-progress')).toBeHidden();
    await expect(page.locator('.cui-msg-error')).toHaveCount(0);
  } finally {
    releaseRouting();
    releaseAnswer();
    releaseStopped();
  }
});

test('Chinese waiting feedback remains localized and stable in a narrow real editor', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript(() =>
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'loopback',
        baseUrl: 'http://localhost:11434',
        model: 'feedback-test',
        preference: 'device-first',
        localWritingConsent: false,
      }),
    ),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let classifications = 0;
  await page.route('http://localhost:11434/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
      return;
    }
    if (route.request().url().endsWith('/tags')) {
      await route.fulfill({ json: { models: [{ name: 'feedback-test' }] } });
      return;
    }
    if (route.request().postDataJSON().format?.properties?.task) {
      classifications++;
      await gate;
    }
    await route.fulfill({
      json: {
        done: true,
        message: { role: 'assistant', content: JSON.stringify({ task: 'chat', language: 'zh-CN' }) },
      },
    });
  });
  try {
    await page.goto('/editor?new=docx&locale=zh-CN');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.evaluate(() => window.__toggleAgentPanel?.());
    await page.locator('.agent-enable-switch').click();
    await page.setViewportSize({ width: 360, height: 640 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const input = page.locator('.cui-input');
    const send = page.locator('.cui-send');
    await input.fill('请解释一下你能帮我完成哪些文档任务。');
    await send.click();
    await expect(page.locator('.agent-panel-endpoint-status')).toContainText('已连接');
    await expect(send).toHaveAccessibleName('发送');
    await send.click();
    await expect.poll(() => classifications).toBe(1);
    await expect(page.locator('.cui-status')).toHaveText('正在理解你的请求…');
    await input.fill('下一条问题草稿');
    const before = (await page.locator('.cui-composer').boundingBox())!;
    await expect(page.locator('.cui-elapsed')).toHaveText(/已等待 [1-9]\d* 秒/);
    await expect(input).toBeFocused();
    const after = (await page.locator('.cui-composer').boundingBox())!;
    expect(Math.abs(before.y - after.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(before.height - after.height)).toBeLessThanOrEqual(1);
    await expect
      .poll(() => page.locator('.agent-runtime-panel').evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThan(2);
    expect(await page.locator('.cui-status').evaluate((el) => getComputedStyle(el, '::before').animationName)).toBe(
      'none',
    );
    await page
      .locator('.agent-runtime-panel')
      .screenshot({ path: testInfo.outputPath('process-routing-zh-narrow.png') });
    await page.locator('.cui-send-stop').click();
    await expect(page.locator('.cui-progress')).toBeHidden();
    await expect(page.locator('.cui-elapsed')).toHaveText('');
    await expect(input).toHaveValue('下一条问题草稿');
    await expect(page.getByRole('log')).toContainText('已停止。');
  } finally {
    release();
  }
});
