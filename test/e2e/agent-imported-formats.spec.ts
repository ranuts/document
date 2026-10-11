import { expect, test } from './lib/l0';
import { buildOdf, ODF_FIXTURES } from './lib/odf';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const legacyCorpus = process.env.LEGACY_AGENT_CORPUS_DIR;

// Synthetic, non-private documents. Controlled responses verify the assistant's
// actual context/review/native execution contract, not a model's interpretation.
const fixtures: Array<{
  ext: string;
  mime: string;
  buffer?: Buffer;
  marker?: string;
  kind: string;
  expectNoSpace?: boolean;
}> = [
  ...ODF_FIXTURES.map((doc) => ({
    ext: doc.ext,
    mime: doc.mime,
    buffer: Buffer.from(buildOdf(doc)),
    marker: `ODF round trip ${doc.ext === 'ods' ? 'cell' : doc.ext === 'odp' ? 'slide' : 'paragraph'}`,
    kind: doc.ext === 'ods' ? 'cell' : doc.ext === 'odp' ? 'slide' : 'word',
  })),
  ...(['txt', 'rtf'] as const).map((ext) => ({
    ext,
    mime: ext === 'txt' ? 'text/plain' : 'application/rtf',
    buffer: Buffer.from(ext === 'rtf' ? '{\\rtf1\\ansi Imported text marker\\par}' : 'Imported text marker'),
    marker: 'Imported text marker',
    kind: 'word',
  })),
  ...[
    { ext: 'doc', file: 'zoom.doc', mime: 'application/msword', kind: 'word' },
    { ext: 'xls', file: 'universal-content.xls', mime: 'application/vnd.ms-excel', kind: 'cell' },
    { ext: 'ppt', file: 'tdf49561.ppt', mime: 'application/vnd.ms-powerpoint', kind: 'slide', expectNoSpace: true },
  ].map((doc) => ({
    ...doc,
    buffer: legacyCorpus ? readFileSync(join(legacyCorpus, doc.file)) : undefined,
  })),
];

for (const fixture of fixtures) {
  test(`${fixture.ext}: assistant reads imported content and ${fixture.expectNoSpace ? 'rejects a crowded insertion, then reviews a selected-text edit and restores it with Undo' : 'reviews a native edit and restores it with one Undo'}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    test.skip(!fixture.buffer, 'Requires the documented public legacy corpus, not private user documents.');
    let marker = fixture.marker ?? '';
    await page.addInitScript(() =>
      localStorage.setItem(
        'agent-writing-endpoint',
        JSON.stringify({
          version: 1,
          kind: 'loopback',
          baseUrl: 'http://localhost:11434',
          model: 'import-contract',
          preference: 'device-first',
          localWritingConsent: false,
        }),
      ),
    );
    let grounded = false;
    let editing = false;
    let replacing = false;
    await page.route('http://localhost:11434/api/**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
        });
        return;
      }
      if (route.request().url().endsWith('/tags')) {
        await route.fulfill({ json: { models: [{ name: 'import-contract' }] } });
        return;
      }
      const request = route.request().postDataJSON();
      let output: unknown;
      if (request.format?.properties?.task) output = { task: editing ? 'tools' : 'chat', language: 'en' };
      else if (request.format) {
        output = replacing
          ? { tool: 'replace_selection', input: { text: 'Reviewed replacement' } }
          : fixture.kind === 'cell'
            ? { tool: 'set_cell', input: { cell: 'A1', value: 'Reviewed replacement' } }
            : fixture.kind === 'slide'
              ? { tool: 'add_slide_text', input: { text: 'Reviewed replacement' } }
              : { tool: 'insert_text', input: { text: 'Reviewed replacement' } };
      } else {
        grounded = JSON.stringify(request.messages).includes(marker);
        output = `The file contains ${marker}.`;
      }
      await route.fulfill({
        json: {
          done: true,
          done_reason: 'stop',
          message: { content: typeof output === 'string' ? output : JSON.stringify(output) },
        },
      });
    });
    await page.goto('/');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    await (
      await chooser
    ).setFiles({ name: `assistant.${fixture.ext}`, mimeType: fixture.mime, buffer: fixture.buffer! });
    await page.waitForURL(/\/editor/);
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.waitForFunction(() => typeof window.__toggleAgentPanel === 'function');
    const read = () =>
      page.evaluate((kind) => {
        const win = window.__ooFrames.readyEditor() as any;
        const api = win.Asc?.editor ?? win.editor;
        if (kind === 'cell') return api.wb.getWorksheet().model.getRange3(0, 0, 0, 0).getValue();
        const doc = api.WordControl.m_oLogicDocument;
        if (kind === 'slide')
          return doc.Slides[0].cSld.spTree.map((shape: any) => shape.getDocContent?.()?.GetText({}) ?? '').join('');
        const characters: number[] = [];
        const visit = (item: any): void => {
          if (!item || typeof item !== 'object') return;
          if (typeof item.GetCodePoint === 'function') characters.push(item.GetCodePoint());
          if (Array.isArray(item.Content)) item.Content.forEach(visit);
        };
        doc.Content.forEach(visit);
        return String.fromCodePoint(...characters);
      }, fixture.kind);
    const before = await read();
    marker ||= before
      .trim()
      .split(/[\r\n]/)[0]
      .slice(0, 50);
    expect(marker).not.toBe('');
    expect(before).toContain(marker);
    await page.evaluate(() => window.__toggleAgentPanel?.());
    await page.locator('.agent-enable-switch').click();
    await page.locator('.agent-panel-endpoint-connect').click();
    await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
    await page.locator('.agent-panel-settings-toggle').click();
    const input = page.locator('.cui-input');
    await input.fill('What content is in the current file?');
    await input.press('Enter');
    await expect(page.locator('.cui-messages')).toContainText(`The file contains ${marker}.`);
    expect(grounded).toBe(true);
    editing = true;
    await input.fill(
      fixture.kind === 'cell'
        ? 'Replace A1 with Reviewed replacement'
        : fixture.kind === 'slide'
          ? 'Add a text box to this slide'
          : 'Insert the proposed text at the cursor',
    );
    await input.press('Enter');
    const review = page.locator('.agent-plan-preview').last();
    await expect(review.locator('.agent-plan-apply')).toBeVisible();
    expect(await read()).toBe(before);
    const historyIndex = () => page.evaluate(() => (window.__ooFrames.readyEditor() as any).AscCommon.History.Index);
    const previousHistory = fixture.expectNoSpace ? await historyIndex() : undefined;
    await review.locator('.agent-plan-apply').click();
    if (fixture.expectNoSpace) {
      await expect(review.locator('[role="status"]')).toContainText('There is not enough space on this slide');
      expect(await read()).toBe(before);
      expect(await historyIndex()).toBe(previousHistory);
      await expect(page.locator('.cui-msg-error')).toHaveCount(0);
      // The existing title is editable even when reserved boxes leave no room
      // for another box. Select its native text, then use the actual review flow.
      await page.evaluate(() => {
        const win = window.__ooFrames.readyEditor() as any;
        const api = win.Asc?.editor ?? win.editor;
        const shape = api.WordControl.m_oLogicDocument.Slides[0].cSld.spTree.find((s: any) =>
          s.getDocContent?.()?.GetText({}).trim(),
        );
        shape.Set_CurrentElement();
        shape.getDocContent().SelectAll();
        api.WordControl.m_oLogicDocument.Document_UpdateSelectionState();
      });
      replacing = true;
      await input.fill('Replace the selected text with exactly the following text:Reviewed replacement');
      await input.press('Enter');
      const replacement = page.locator('.agent-plan-preview').last();
      await expect(replacement.locator('.agent-plan-apply')).toBeVisible();
      expect(await read()).toBe(before);
      await replacement.locator('.agent-plan-apply').click();
      await expect.poll(read).toBe(before.replace(marker, 'Reviewed replacement'));
      await page.evaluate(() => {
        const win = window.__ooFrames.readyEditor() as any;
        (win.Asc?.editor ?? win.editor).Undo();
      });
      await expect.poll(read).toBe(before);
      return;
    }
    await expect.poll(read).toContain('Reviewed replacement');
    if (fixture.kind !== 'cell') expect(await read()).toContain(marker);
    await page.evaluate(() => {
      const win = window.__ooFrames.readyEditor() as any;
      (win.Asc?.editor ?? win.editor).Undo();
    });
    await expect.poll(read).toBe(before);
    await expect(page.locator('.cui-msg-error')).toHaveCount(0);
  });
}
