import type { Page } from '@playwright/test';
import { expect, test } from './lib/l0';

declare global {
  interface Window {
    /** Set by the editor entry (`index.ts`) when the agent feature is enabled. */
    __toggleAgentPanel?: () => void;
  }
}

/**
 * The agent's document writes, driven through the real panel against a real v9 editor.
 *
 * The three write mechanisms this covers are the ones the tools actually use:
 *  - Excel writes the spreadsheet model directly (`writeExcelCellText`).
 *  - Word goes through the native HTML paste wrapper (`pasteWordHtml`).
 *  - Presentations go through the slide tools (`slide_action`).
 *
 * Every entry here was chosen because it is reachable **without a model**: the
 * closed "read <range>, then set <cell> to \"<literal>\"" phrase is applied
 * directly, and the write-the-last-answer / slide intents are a fixed grammar.
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
    await page.addInitScript(() => {
      // Pin the GGUF provider with no model configured, so the panel's idle
      // auto-load has nothing to fetch: an E2E run must not pull a multi-gigabyte
      // browser model. Every agent path under test here is model-free.
      localStorage.setItem('agent-panel-provider', 'wllama');
    });
    await page.goto(`/editor?new=${fresh}&agent=1`);
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.waitForFunction(() => typeof window.__toggleAgentPanel === 'function');
    await page.evaluate(() => window.__toggleAgentPanel?.());
    await expect(page.locator('.agent-panel')).not.toHaveClass(/agent-panel-hidden/);
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
      row.textContent = text;
      messages.append(row);
    }, answer);

  /** Type a request into the panel and send it. */
  const send = async (page: Page, task: string, text: string): Promise<void> => {
    await page.selectOption('.agent-writing-task', task);
    const input = page.locator('.cui-input');
    // Sending is refused while the panel is busy; wait rather than race it.
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

  test('writes a spreadsheet cell through the model-level writer', async ({ page }) => {
    await openEditorWithPanel(page, 'xlsx');
    await send(page, 'tools', 'read A1:A5, then set B1 to "agent wrote this"');
    await expect.poll(() => readCell(page, 'B1'), { timeout: 30_000 }).toBe('agent wrote this');
    await undo(page);
    await expect.poll(() => readCell(page, 'B1')).not.toBe('agent wrote this');
  });

  test('writes into a Word document through the native paste wrapper', async ({ page }) => {
    await openEditorWithPanel(page, 'docx');
    await seedAnswer(page, 'SEEDED ANSWER FOR THE AGENT');
    await send(page, 'chat', '把上一条回答写入文档');
    await expect.poll(readWordText.bind(null, page), { timeout: 30_000 }).toContain('SEEDED ANSWER FOR THE AGENT');
    await undo(page);
    await expect.poll(readWordText.bind(null, page)).not.toContain('SEEDED ANSWER FOR THE AGENT');
  });

  test('adds a slide through the presentation tools', async ({ page }) => {
    await openEditorWithPanel(page, 'pptx');
    const before = await countSlides(page);
    await send(page, 'chat', '新增幻灯片');
    await expect.poll(() => countSlides(page), { timeout: 30_000 }).toBe(before + 1);
    await undo(page);
    await expect.poll(() => countSlides(page)).toBe(before);
  });
});
