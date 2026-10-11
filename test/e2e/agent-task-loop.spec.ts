import { expect, test } from './lib/l0';
import { taskProtocol } from './lib/task-protocol';

for (const native of [false, true])
  for (const repeat of [false, true])
    test(`${native ? 'native' : 'schema'} creates a slide with separate title and body after one review and restores it with one Undo${repeat ? ' after a refused repeat' : ''}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      await page.addInitScript((native) => {
        const baseUrl = native ? 'https://assistant.example.invalid/v1' : 'http://localhost:11434';
        if (native) localStorage.setItem(`agent_endpoint_key_${encodeURIComponent(baseUrl)}`, 'test-only-key');
        localStorage.setItem(
          'agent-writing-endpoint',
          JSON.stringify({
            version: 1,
            kind: native ? 'openai-compatible' : 'loopback',
            baseUrl,
            model: 'task-test',
            preference: 'device-first',
            localWritingConsent: false,
          }),
        );
      }, native);
      let nativeCalls = 0;
      if (native)
        await page.route('https://assistant.example.invalid/v1/chat/completions', async (route) => {
          const request = route.request().postDataJSON();
          expect(request.tools.some((tool: any) => tool.function.name === 'create_slide')).toBe(true);
          nativeCalls++;
          await route.fulfill({
            json: {
              choices: [
                {
                  message:
                    nativeCalls === 1 || repeat
                      ? {
                          content: null,
                          tool_calls: [
                            {
                              id: `native-${nativeCalls}`,
                              type: 'function',
                              function: {
                                name: 'create_slide',
                                arguments: JSON.stringify({
                                  title: 'Project budget',
                                  body: 'Budget: 120\nDue: November 1',
                                }),
                              },
                            },
                          ],
                        }
                      : { content: 'Added the reviewed slide.' },
                  finish_reason: nativeCalls === 1 || repeat ? 'tool_calls' : 'stop',
                },
              ],
            },
          });
        });
      await page.route('http://localhost:11434/api/**', async (route) => {
        if (route.request().url().endsWith('/tags'))
          return route.fulfill({ json: { models: [{ name: 'task-test' }] } });
        const request = route.request().postDataJSON();
        const output = request.format?.properties?.task
          ? { task: 'tools', language: 'en' }
          : repeat && request.format?.oneOf
            ? {
                kind: 'tool',
                tool: 'create_slide',
                input: { title: 'Project budget', body: 'Budget: 120\nDue: November 1' },
              }
            : taskProtocol(request, {
                tool: 'create_slide',
                input: { title: 'Project budget', body: 'Budget: 120\nDue: November 1' },
              });
        await route.fulfill({
          json: {
            done: true,
            done_reason: 'stop',
            message: { content: typeof output === 'string' ? output : JSON.stringify(output) },
          },
        });
      });
      await page.goto('/editor?new=pptx');
      await page.waitForFunction(
        () => Boolean(window.__ooFrames.readyEditor()) && typeof window.__toggleAgentPanel === 'function',
      );
      await page.evaluate(() => window.__toggleAgentPanel?.());
      await page.locator('.agent-enable-switch').click();
      await page.locator('.agent-panel-settings-toggle').click();
      await page.locator('.agent-panel-endpoint-connect').click();
      await expect(page.locator('.agent-panel-endpoint-status')).toContainText(native ? 'Configured' : 'Connected');
      await page.locator('.agent-panel-settings-toggle').click();
      const readSlides = () =>
        page.evaluate(() => {
          const win = window.__ooFrames.readyEditor() as any;
          return (win.Asc?.editor ?? win.editor).WordControl.m_oLogicDocument.Slides.map((slide: any) =>
            slide.cSld.spTree.map(
              (shape: any) => shape.getDocContent?.()?.GetText({})?.replace(/\r\n?/g, '\n').trim() ?? '',
            ),
          );
        });
      const before = await readSlides();
      await page
        .locator('.cui-input')
        .fill('Add a new slide with title Project budget and body Budget: 120 and Due: November 1.');
      await page.locator('.cui-input').press('Enter');
      const preview = page.locator('.agent-plan-preview').last();
      await expect(preview.locator('.agent-plan-content')).toContainText('Title: Project budget');
      await expect(preview.locator('.agent-plan-content')).toContainText('Body:');
      expect(await readSlides()).toEqual(before);
      await preview.locator('.agent-plan-apply').click();
      await expect(preview).toHaveAttribute('data-state', 'verified');
      await expect(page.locator('.cui-send-stop')).toHaveCount(0);
      if (repeat) {
        await expect(page.locator('.cui-messages')).toContainText('Approved changes applied: 1.');
        await expect(page.locator('.cui-messages')).toContainText('without applying it again');
        await expect(page.locator('.cui-msg-error')).toHaveCount(0);
        await expect(page.locator('.agent-plan-preview')).toHaveCount(1);
      }
      const after = await readSlides();
      expect(after.slice(0, -1)).toEqual(before);
      expect(after.at(-1)).toEqual(['Project budget', 'Budget: 120\nDue: November 1']);
      await page.screenshot({ path: testInfo.outputPath('structured-slide.png') });
      await page.evaluate(() => {
        const win = window.__ooFrames.readyEditor() as any;
        (win.Asc?.editor ?? win.editor).Undo();
      });
      expect(await readSlides()).toEqual(before);
    });

for (const cancel of [false, true]) {
  test(`schema task: a reviewed slide addition ${cancel ? 'stops before a cancelled text insertion' : 'continues with text on the new slide'}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() =>
      localStorage.setItem(
        'agent-writing-endpoint',
        JSON.stringify({
          version: 1,
          kind: 'loopback',
          baseUrl: 'http://localhost:11434',
          model: 'task-test',
          preference: 'device-first',
          localWritingConsent: false,
        }),
      ),
    );
    let decisions = 0;
    await page.route('http://localhost:11434/api/**', async (route) => {
      if (route.request().url().endsWith('/tags')) {
        await route.fulfill({ json: { models: [{ name: 'task-test' }] } });
        return;
      }
      const request = route.request().postDataJSON();
      let output: unknown = 'connected';
      if (request.format?.properties?.task) output = { task: 'tools', language: 'en' };
      else if (request.format?.oneOf?.some((b: any) => b.properties?.kind)) {
        decisions++;
        const prompt = request.messages.at(-1).content as string;
        if (decisions > 1) expect(prompt).toContain('verified');
        if (decisions === 2) expect(prompt).toContain('"page":2');
        output =
          decisions === 1
            ? { kind: 'tool', tool: 'slide_action', input: { action: 'add' } }
            : decisions === 2
              ? { kind: 'tool', tool: 'add_slide_text', input: { text: 'Budget 120' } }
              : { kind: 'answer', text: 'Added a slide and Budget 120.', disposition: 'answered' };
      }
      await route.fulfill({
        json: {
          done: true,
          done_reason: 'stop',
          message: { content: typeof output === 'string' ? output : JSON.stringify(output) },
        },
      });
    });
    await page.goto('/editor?new=pptx');
    await page.waitForFunction(
      () => Boolean(window.__ooFrames.readyEditor()) && typeof window.__toggleAgentPanel === 'function',
    );
    await page.evaluate(() => window.__toggleAgentPanel?.());
    await page.locator('.agent-enable-switch').click();
    await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
    await page.locator('.agent-panel-settings-toggle').click();
    await page.locator('.agent-panel-endpoint-connect').click();
    await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
    await page.locator('.agent-panel-settings-toggle').click();
    const input = page.locator('.cui-input');
    await input.fill('Create a new slide and add a text box containing Budget 120.');
    await input.press('Enter');
    const first = page.locator('.agent-plan-preview').first();
    await expect(first.locator('.agent-plan-content')).toHaveText('Add one slide');
    expect(decisions).toBe(1);
    await first.locator('.agent-plan-apply').click();
    const second = page.locator('.agent-plan-preview').last();
    await expect(second.locator('.agent-plan-content')).toHaveText('Budget 120');
    await expect(second.locator('.agent-plan-target')).toContainText('Slide 2');
    expect(decisions).toBe(2);
    await second.locator(cancel ? '.agent-plan-cancel' : '.agent-plan-apply').click();
    await expect(page.locator('.cui-send-stop')).toHaveCount(0);
    expect(decisions).toBe(cancel ? 2 : 3);
    const slides = await page.evaluate(() => {
      const win = window.__ooFrames.readyEditor() as any;
      const doc = (win.Asc?.editor ?? win.editor).WordControl.m_oLogicDocument;
      return doc.Slides.map((slide: any) =>
        slide.cSld.spTree.map((shape: any) => shape.getDocContent?.()?.GetText({}) ?? '').join(''),
      );
    });
    expect(slides).toHaveLength(2);
    expect(slides[0]).not.toContain('Budget 120');
    if (cancel) expect(slides[1]).not.toContain('Budget 120');
    else expect(slides[1]).toContain('Budget 120');
  });
}
