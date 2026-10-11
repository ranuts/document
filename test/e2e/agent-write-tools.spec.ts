import type { Page } from '@playwright/test';
import { expect, test } from './lib/l0';

declare global {
  interface Window {
    /** Set by the editor entry (`index.ts`) when the agent feature is enabled. */
    __toggleAgentPanel?: () => void;
    __agentPastePending?: boolean;
    __releaseAgentPaste?: () => void;
  }
}

/**
 * The agent's document writes, driven through the real panel against a real v9 editor.
 *
 * The three write mechanisms this covers are the ones the tools actually use:
 *  - Excel uses a protected native paste pipeline (`writeExcelCellText` / auto value entry).
 *  - Word goes through the native HTML paste wrapper (`pasteWordHtml`).
 *  - Presentations go through the slide tools (`slide_action`).
 *
 * Every entry here was chosen because it is reachable **without a model**: the
 * closed "read <range>, then set <cell> to \"<literal>\"" phrase produces a
 * preview for confirmation, and the write-the-last-answer / slide intents are a fixed grammar.
 * That is what makes the suite usable in CI, where no model runs. Model-driven
 * tool choice is therefore still uncovered -- a gap, not an implied pass.
 *
 * The editor api is reached across frames (same origin) from inside `page.evaluate`;
 * `window.__ooFrames` is installed by the L0 fixture in every frame.
 */
test.describe('agent document writes (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  /** Mount the editor with the panel open, with nothing to auto-download. */
  const openEditorWithPanel = async (page: Page, fresh: 'xlsx' | 'docx' | 'pptx'): Promise<void> => {
    await page.goto(`/editor?new=${fresh}`);
    await mountPanel(page);
  };
  const mountPanel = async (page: Page): Promise<void> => {
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.waitForFunction(() => typeof window.__toggleAgentPanel === 'function');
    await page.evaluate(() => window.__toggleAgentPanel?.());
    await page.locator('.agent-enable-switch').click();
    await expect(page.locator('.agent-runtime-panel')).not.toHaveClass(/agent-panel-hidden/);
    await page.locator('.agent-panel-settings-toggle').click();
    await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
  };

  /**
   * Supply a completed answer without running a model.
   *
   * Conversation history lives in the panel's own store (memory plus opt-in
   * IndexedDB), so there is no localStorage record to seed. `getLastAnswer()` reads
   * exactly this node's `dataset.source`; everything downstream of it -- the intent,
   * the paste, the undo grouping -- is the real code path.
   */
  const seedAnswer = (page: Page, answer: string) =>
    page.evaluate((text) => {
      const messages = document.querySelector('.cui-messages');
      if (!messages) throw new Error('Panel conversation is not mounted');
      const row = document.createElement('div');
      row.className = 'cui-msg cui-msg-agent';
      row.dataset.source = text;
      row.dataset.documentArtifact = 'true';
      row.textContent = text;
      messages.append(row);
    }, answer);

  /** Type a request into the panel and send it. */
  const send = async (page: Page, text: string): Promise<void> => {
    const input = page.locator('.cui-input');
    // Drafts remain editable while busy; wait for submission to become available.
    await expect(page.locator('.cui-send-stop')).toHaveCount(0);
    await expect(input).toBeEnabled();
    await input.fill(text);
    await input.press('Enter');
  };

  const readCell = (page: Page, address: string) =>
    page.evaluate((target) => {
      const win = window.__ooFrames.editor() as unknown as { Asc?: { editor?: unknown }; editor?: unknown } | null;
      const api = (win?.Asc?.editor ?? win?.editor) as {
        wb: {
          getWorksheet(): {
            model: { getRange3(r1: number, c1: number, r2: number, c2: number): { getValue(): string } };
          };
        };
      };
      const parsed = /^([A-Z]+)(\d+)$/.exec(target)!;
      let column = 0;
      for (const ch of parsed[1]) column = column * 26 + (ch.charCodeAt(0) - 64);
      const row = Number(parsed[2]) - 1;
      return api.wb
        .getWorksheet()
        .model.getRange3(row, column - 1, row, column - 1)
        .getValue();
    }, address);

  /** A read-then-write request must leave the cell untouched until confirmation. */
  const confirmCellWrite = async (page: Page, address: string, value: string): Promise<void> => {
    const preview = page.locator('.agent-plan-preview').last();
    await expect(preview).toBeVisible();
    await expect(preview.locator('.agent-plan-target')).toContainText(address);
    await expect(preview.locator('.agent-plan-content')).toHaveText(value);
    expect(await readCell(page, address)).toBe('');
    await preview.locator('.agent-plan-apply').click();
  };

  const readWordText = (page: Page) =>
    page.evaluate(() => {
      const win = window.__ooFrames.editor() as unknown as { Asc?: { editor?: unknown }; editor?: unknown } | null;
      const api = (win?.Asc?.editor ?? win?.editor) as {
        asc_EditSelectAll(): void;
        pluginMethod_GetSelectedText(options: { TabSymbol: string; Numbering: boolean }): string;
      };
      api.asc_EditSelectAll();
      return api.pluginMethod_GetSelectedText({ TabSymbol: '\t', Numbering: false });
    });

  const countSlides = (page: Page) =>
    page.evaluate(() => {
      const win = window.__ooFrames.editor() as unknown as { Asc?: { editor?: unknown }; editor?: unknown } | null;
      const api = (win?.Asc?.editor ?? win?.editor) as {
        WordControl: { m_oLogicDocument: { Slides: unknown[] } };
      };
      return api.WordControl.m_oLogicDocument.Slides.length;
    });

  /** The editor's own Undo, the guarantee that a write is one reversible step. */
  const undo = (page: Page) =>
    page.evaluate(() => {
      const win = window.__ooFrames.editor() as unknown as { Asc?: { editor?: unknown }; editor?: unknown } | null;
      const api = (win?.Asc?.editor ?? win?.editor) as { Undo(): void };
      api.Undo();
    });

  test('reviews and writes a CSV cell without treating it as Word or changing neighboring data', async ({ page }) => {
    await page.goto('/');
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'agent-context.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name,score\nAlice,90\nBob,85'),
    });
    await mountPanel(page);
    expect(await readCell(page, 'A2')).toBe('Alice');
    expect(await readCell(page, 'B2')).toBe('90');
    await send(page, 'read A2:B2, then set B2 to "95"');
    const review = page.locator('.agent-plan-preview').last();
    await expect(review).toBeVisible();
    await expect(review.locator('.agent-plan-target')).toContainText('B2');
    await expect(review.locator('.agent-plan-target')).not.toContainText('Excel');
    await expect(review.locator('.agent-plan-comparison')).toContainText('90');
    await expect(review.locator('.agent-plan-comparison')).toContainText('95');
    expect(await readCell(page, 'B2')).toBe('90');
    await review.locator('.agent-plan-apply').click();
    await expect.poll(() => readCell(page, 'B2')).toBe('95');
    expect(await readCell(page, 'A2')).toBe('Alice');
    expect(await readCell(page, 'B3')).toBe('85');
    await undo(page);
    await expect.poll(() => readCell(page, 'B2')).toBe('90');
  });

  // The provider is controlled; all review, validation, paste and Undo use the real editor.
  // This exercises host behavior, not the accuracy of any production model.
  test('edits and refines an unexecuted proposal before one real Word write', async ({ page }, testInfo) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'agent-writing-endpoint',
        JSON.stringify({
          version: 1,
          kind: 'loopback',
          baseUrl: 'http://localhost:11434',
          model: 'hitl-test',
          preference: 'device-first',
          localWritingConsent: false,
        }),
      ),
    );
    let refinements = 0;
    await page.route('http://localhost:11434/api/**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
        });
        return;
      }
      if (route.request().url().endsWith('/tags')) {
        await route.fulfill({ json: { models: [{ name: 'hitl-test' }] } });
        return;
      }
      const request = route.request().postDataJSON();
      const prompt = JSON.stringify(request.messages);
      const refining = request.messages.some((message: { content: string }) =>
        message.content.includes('"executed":false'),
      );
      if (refining) {
        refinements++;
        expect(prompt).toContain('Edited draft');
        expect(prompt).toContain('executed');
      }
      const output =
        refining && refinements === 2
          ? { tool: 'unsupported', input: {} }
          : request.format?.properties?.task
            ? { task: 'chat', language: 'en' } // This literal command must bypass semantic routing.
            : {
                tool: 'insert_text',
                input: {
                  text: refining ? (refinements === 1 ? 'Edited draft' : 'Final reviewed text') : 'Initial draft',
                },
              };
      await route.fulfill({ json: { done: true, done_reason: 'stop', message: { content: JSON.stringify(output) } } });
    });
    await openEditorWithPanel(page, 'docx');
    await page.locator('.agent-panel-settings-toggle').click();
    await page.locator('.agent-panel-endpoint-connect').click();
    await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
    await page.locator('.agent-panel-settings-toggle').click();
    await send(page, 'Insert exactly this plain text at the cursor: Initial draft');
    const first = page.locator('.agent-plan-preview').first();
    await expect(first.locator('.agent-plan-edit')).toBeVisible();
    await first.locator('.agent-plan-edit').click();
    await expect(first.locator('.agent-plan-draft')).toBeFocused();
    await first.locator('.agent-plan-draft').fill('Edited draft');
    await first.locator('.agent-plan-draft').press('Escape');
    await expect(first.locator('.agent-plan-draft')).toBeHidden();
    await expect(first).toBeFocused();
    await first.locator('.agent-plan-edit').click();
    await first.locator('.agent-plan-draft').fill('Edited draft');
    await first.locator('.agent-plan-save').click();
    await expect(first.locator('.agent-plan-comparison')).toContainText('Edited draft');
    await first.locator('.agent-plan-refine').click();
    await expect(page.locator('.agent-refinement-context')).toBeVisible();
    await send(page, 'Make this suggestion more concise');
    await expect(page.locator('.cui-messages')).toContainText('The suggestion is unchanged');
    await expect(first).toHaveAttribute('data-state', 'pending');
    await expect(first.locator('.agent-plan-apply')).not.toHaveAttribute('disabled', '');
    expect(
      await page.evaluate(() => {
        const win = window.__ooFrames.readyEditor() as unknown as {
          Asc: { editor: { WordControl: { m_oLogicDocument: { Content: unknown[] } } } };
        };
        const characters: number[] = [];
        const visit = (node: unknown): void => {
          if (!node || typeof node !== 'object') return;
          const item = node as { Content?: unknown[]; GetCodePoint?: () => number };
          if (item.GetCodePoint) characters.push(item.GetCodePoint());
          if (Array.isArray(item.Content)) item.Content.forEach(visit);
        };
        win.Asc.editor.WordControl.m_oLogicDocument.Content.forEach(visit);
        return String.fromCodePoint(...characters).trim();
      }),
    ).toBe('');
    await send(page, 'Try again, make this suggestion more concise');
    await expect(page.locator('.cui-send')).not.toHaveText('Stop');
    await expect(first).toHaveAttribute('data-state', 'pending');
    await expect(first.locator('.agent-plan-apply')).not.toHaveAttribute('disabled', '');
    await expect(page.locator('.agent-plan-preview')).toHaveCount(1);
    expect(
      await page.evaluate(() => {
        const win = window.__ooFrames.readyEditor() as unknown as {
          Asc: { editor: { WordControl: { m_oLogicDocument: { Content: unknown[] } } } };
        };
        const characters: number[] = [];
        const visit = (node: unknown): void => {
          if (!node || typeof node !== 'object') return;
          const item = node as { Content?: unknown[]; GetCodePoint?: () => number };
          if (item.GetCodePoint) characters.push(item.GetCodePoint());
          if (Array.isArray(item.Content)) item.Content.forEach(visit);
        };
        win.Asc.editor.WordControl.m_oLogicDocument.Content.forEach(visit);
        return String.fromCodePoint(...characters).trim();
      }),
    ).toBe('');
    await send(page, 'Revise the suggestion again');
    const replacement = page.locator('.agent-plan-preview').last();
    await expect(replacement.locator('.agent-plan-comparison')).toContainText('Final reviewed text');
    expect(refinements).toBe(3);
    await expect(first.locator('.agent-plan-apply')).toBeHidden();
    await replacement.locator('.agent-plan-apply').click();
    await expect.poll(() => readWordText(page)).toContain('Final reviewed text');
    expect(await readWordText(page)).not.toContain('Initial draft');
    expect(await readWordText(page)).not.toContain('Edited draft');
    await expect(replacement.locator('.agent-plan-primary-buttons')).toBeHidden();
    await expect(page.locator('.agent-readiness')).toHaveText('');
    await replacement.locator('.agent-plan-record summary').click();
    await expect(replacement.locator('.agent-plan-record')).toContainText('Final reviewed text');
    await page.setViewportSize({ width: 320, height: 850 });
    const fits = await replacement.evaluate((card) => {
      const composer = document.querySelector('.cui-composer')!.getBoundingClientRect();
      return card.scrollWidth <= card.clientWidth + 1 && composer.bottom <= innerHeight + 1;
    });
    expect(fits).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('review-record.png') });
    await undo(page);
    await expect.poll(() => readWordText(page)).not.toContain('Final reviewed text');
    await expect(page.locator('.cui-msg-error')).toHaveCount(1);
    await expect(page.locator('.cui-msg-error')).toHaveAttribute(
      'data-source',
      'No executable operation was selected. Clarify the request or try another model.',
    );
  });

  test('writes a spreadsheet cell through the model-level writer', async ({ page }) => {
    await openEditorWithPanel(page, 'xlsx');
    await send(page, 'read A1:A5, then set B1 to "agent wrote this"');
    expect(await readCell(page, 'B1')).toBe('');
    await confirmCellWrite(page, 'B1', 'agent wrote this');
    await expect.poll(() => readCell(page, 'B1'), { timeout: 30_000 }).toBe('agent wrote this');
    await undo(page);
    await expect.poll(() => readCell(page, 'B1')).not.toBe('agent wrote this');
  });

  test('writes auto numeric values and SUM formulas as separate undo steps', async ({ page }) => {
    await openEditorWithPanel(page, 'xlsx');
    await send(page, 'read A1:A5, then set A1 to 1.0');
    await confirmCellWrite(page, 'A1', '1.0');
    await expect.poll(() => readCell(page, 'A1')).toBe('1');
    await expect(page.locator('.cui-send-stop')).toHaveCount(0);
    await expect(page.locator('.cui-input')).toBeEnabled();
    await send(page, 'sum A1:A1 into B1');
    await expect.poll(() => readCell(page, 'B1')).toBe('1');
    await expect(page.locator('.cui-send-stop')).toHaveCount(0);
    await expect(page.locator('.cui-input')).toBeEnabled();
    expect(
      await page.evaluate(() => {
        const win = window.__ooFrames.readyEditor() as unknown as { Asc: { editor: unknown } };
        const api = win.Asc.editor as {
          wb: {
            getWorksheet(): {
              model: { getRange3(r1: number, c1: number, r2: number, c2: number): { getFormula(): string } };
            };
          };
        };
        return api.wb.getWorksheet().model.getRange3(0, 1, 0, 1).getFormula().replace(/^=/, '');
      }),
    ).toBe('SUM(A1:A1)');
    await send(page, 'read A1:A1, then set B1 to 9');
    const review = page.locator('.agent-plan-preview').last();
    await expect(review.locator('table')).toContainText('SUM(A1:A1)');
    const cells = review.locator('tbody tr').first().locator('td');
    await expect(cells.nth(0)).toContainText('1');
    await expect(cells.nth(1)).toHaveText('9');
    expect(await readCell(page, 'B1')).toBe('1');
    await review.locator('.agent-plan-cancel').click();
    await undo(page);
    await expect.poll(() => readCell(page, 'B1')).toBe('');
    expect(await readCell(page, 'A1')).toBe('1');
    await undo(page);
    await expect.poll(() => readCell(page, 'A1')).toBe('');
    await expect(page.locator('.cui-msg-error')).toHaveCount(0);
  });

  for (const operation of ['auto', 'sum'] as const) {
    test(`a stopped ${operation} write cannot resume through a delayed native font callback`, async ({ page }) => {
      await openEditorWithPanel(page, 'xlsx');
      if (operation === 'sum') {
        await send(page, 'read A1:A5, then set A1 to 5');
        await confirmCellWrite(page, 'A1', '5');
        await expect.poll(() => readCell(page, 'A1')).toBe('5');
        await expect(page.locator('.cui-send-stop')).toHaveCount(0);
        await expect(page.locator('.cui-input')).toBeEnabled();
      }
      await page.evaluate(() => {
        const win = window.__ooFrames.readyEditor() as unknown as { Asc: { editor: unknown } };
        const api = win.Asc.editor as {
          wb: { getWorksheet(): { _loadFonts(fonts: unknown, done: () => void): void } };
        };
        const view = api.wb.getWorksheet();
        const original = view._loadFonts;
        view._loadFonts = function (_fonts, done) {
          window.__agentPastePending = true;
          window.__releaseAgentPaste = () => {
            view._loadFonts = original;
            Reflect.apply(done, view, []);
          };
        };
      });
      await send(page, operation === 'auto' ? 'read A1:A5, then set B1 to 7' : 'sum A1:A1 into B1');
      if (operation === 'auto') await confirmCellWrite(page, 'B1', '7');
      await page.waitForFunction(() => window.__agentPastePending === true);
      if (operation === 'auto') {
        await page.locator('.agent-plan-preview').last().locator('.agent-plan-cancel').click();
        await expect(page.locator('.agent-plan-preview').last()).toBeHidden();
      } else await page.locator('.cui-send-stop').click();
      await page.evaluate(async () => {
        window.__releaseAgentPaste?.();
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      await expect(page.locator('.cui-send-stop')).toHaveCount(0);
      await expect(page.locator('.cui-input')).toBeEnabled();
      expect(await readCell(page, 'B1')).toBe('');
      if (operation === 'sum') expect(await readCell(page, 'A1')).toBe('5');
    });
  }

  test('writes into a Word document through the native paste wrapper', async ({ page }) => {
    await openEditorWithPanel(page, 'docx');
    await seedAnswer(page, 'SEEDED ANSWER FOR THE AGENT');
    await send(page, '把上一条回答写入文档');
    await expect.poll(readWordText.bind(null, page), { timeout: 30_000 }).toContain('SEEDED ANSWER FOR THE AGENT');
    await undo(page);
    await expect.poll(readWordText.bind(null, page)).not.toContain('SEEDED ANSWER FOR THE AGENT');
  });

  test('edits an added slide text box without deleting existing shapes', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'agent-writing-endpoint',
        JSON.stringify({
          version: 1,
          kind: 'loopback',
          baseUrl: 'http://localhost:11434',
          model: 'hitl-test',
          preference: 'device-first',
          localWritingConsent: false,
        }),
      ),
    );
    await page.route('http://localhost:11434/api/**', async (route) => {
      if (route.request().url().endsWith('/tags')) {
        await route.fulfill({ json: { models: [{ name: 'hitl-test' }] } });
        return;
      }
      const request = route.request().postDataJSON();
      const output = request.format?.properties?.task
        ? { task: 'tools', language: 'en' }
        : { tool: 'add_slide_text', input: { text: 'Initial slide draft' } };
      await route.fulfill({ json: { done: true, done_reason: 'stop', message: { content: JSON.stringify(output) } } });
    });
    await openEditorWithPanel(page, 'pptx');
    await page.locator('.agent-panel-settings-toggle').click();
    await page.locator('.agent-panel-endpoint-connect').click();
    await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
    await page.locator('.agent-panel-settings-toggle').click();
    const shapeTexts = () =>
      page.evaluate(() => {
        const win = window.__ooFrames.readyEditor() as unknown as {
          Asc: {
            editor: {
              WordControl: {
                m_oLogicDocument: {
                  Slides: Array<{
                    cSld: { spTree: Array<{ getDocContent?(): { GetText(options: object): string } | undefined }> };
                  }>;
                };
              };
            };
          };
        };
        return win.Asc.editor.WordControl.m_oLogicDocument.Slides[0].cSld.spTree.map(
          (shape) => shape.getDocContent?.()?.GetText({}) ?? '',
        );
      });
    const before = await shapeTexts();
    await send(page, 'Add a short text box to this slide');
    const review = page.locator('.agent-plan-preview').last();
    await expect(review.locator('.agent-plan-edit')).toBeVisible();
    await expect(review.locator('.agent-plan-target')).toHaveText('Slide 1');
    expect(await shapeTexts()).toEqual(before);
    await review.locator('.agent-plan-edit').click();
    await review.locator('.agent-plan-draft').fill('Final slide text');
    await review.locator('.agent-plan-save').click();
    await review.locator('.agent-plan-apply').click();
    await expect.poll(async () => (await shapeTexts()).join('')).toContain('Final slide text');
    expect((await shapeTexts()).slice(0, before.length)).toEqual(before);
    expect((await shapeTexts()).join('')).not.toContain('Initial slide draft');
    await undo(page);
    await expect.poll(shapeTexts).toEqual(before);
  });

  test('reviews a model-proposed slide addition in plain language before applying it', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'agent-writing-endpoint',
        JSON.stringify({
          version: 1,
          kind: 'loopback',
          baseUrl: 'http://localhost:11434',
          model: 'hitl-test',
          preference: 'device-first',
          localWritingConsent: false,
        }),
      ),
    );
    await page.route('http://localhost:11434/api/**', async (route) => {
      if (route.request().url().endsWith('/tags')) {
        await route.fulfill({ json: { models: [{ name: 'hitl-test' }] } });
        return;
      }
      const request = route.request().postDataJSON();
      const output = request.format?.properties?.task
        ? { task: 'tools', language: 'en' }
        : { tool: 'slide_action', input: { action: 'add' } };
      await route.fulfill({ json: { done: true, done_reason: 'stop', message: { content: JSON.stringify(output) } } });
    });
    await openEditorWithPanel(page, 'pptx');
    await page.locator('.agent-panel-settings-toggle').click();
    await page.locator('.agent-panel-endpoint-connect').click();
    await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
    await page.locator('.agent-panel-settings-toggle').click();
    const before = await countSlides(page);
    await send(page, 'Please create another page in this presentation and let me review the change');
    const review = page.locator('.agent-plan-preview').last();
    await expect(review.locator('.agent-plan-content')).toHaveText('Add one slide');
    await expect(review.locator('.agent-plan-target')).toHaveText('Slide 1');
    expect(await countSlides(page)).toBe(before);
    await review.locator('.agent-plan-apply').click();
    await expect.poll(() => countSlides(page)).toBe(before + 1);
    await undo(page);
    await expect.poll(() => countSlides(page)).toBe(before);
  });

  test('adds a slide through the presentation tools', async ({ page }) => {
    await openEditorWithPanel(page, 'pptx');
    const before = await countSlides(page);
    await send(page, '新增幻灯片');
    await expect.poll(() => countSlides(page), { timeout: 30_000 }).toBe(before + 1);
    await undo(page);
    await expect.poll(() => countSlides(page)).toBe(before);
  });
});
