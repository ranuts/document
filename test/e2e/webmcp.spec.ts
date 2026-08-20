import { buildDocx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';
import { waitForEditorReady } from './actions/editor';

/**
 * WebMCP against the real editor.
 *
 * Until now this adapter had unit tests only, which mock every editor function
 * it calls -- so they prove the wiring and nothing about whether a tool actually
 * does what its description promises. The API itself is behind a Chrome origin
 * trial and absent in the test browser, so the surface is injected before any
 * script runs (exactly as the browser would provide it) and the tools are then
 * driven against a real document.
 *
 * `document.modelContext` is the current location; `navigator.modelContext` was
 * the pre-2026-07 one. The adapter probes both, and this covers the current one.
 */

const INSTALL_SURFACE = () => {
  const registered: Record<string, unknown> = {};
  (document as unknown as { modelContext: unknown }).modelContext = {
    registerTool(tool: { name: string }) {
      registered[tool.name] = tool;
    },
    unregisterTool(name: string) {
      delete registered[name];
    },
  };
  (window as unknown as { __webmcpTools: Record<string, unknown> }).__webmcpTools = registered;
};

/** Call a registered tool and parse its MCP text result back into JSON. */
const callTool = (page: import('@playwright/test').Page, name: string, input: Record<string, unknown> = {}) =>
  page.evaluate(
    async ([toolName, args]) => {
      const tools = (window as unknown as { __webmcpTools: Record<string, any> }).__webmcpTools;
      const tool = tools[toolName as string];
      if (!tool) throw new Error(`tool ${toolName} is not registered`);
      const result = await tool.execute(args);
      return { isError: Boolean(result.isError), data: JSON.parse(result.content[0].text) };
    },
    [name, input] as const,
  );

test.describe('WebMCP tools (real editor)', () => {
  test.describe.configure({ timeout: 240_000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(INSTALL_SURFACE);
  });

  test('registers on the editor page and reports its state', async ({ page }) => {
    await page.goto('/editor?new=docx');
    await expect
      .poll(() => page.evaluate(() => Object.keys((window as any).__webmcpTools ?? {})), { timeout: 60_000 })
      .toContain('get_document_state');

    const names = await page.evaluate(() => Object.keys((window as any).__webmcpTools));
    expect(names).toEqual([
      'open_document_url',
      'open_document_buffer',
      'create_document',
      'save_document',
      'get_document_text',
      'set_readonly',
      'get_document_state',
    ]);

    // Every tool must carry a schema an agent can plan against.
    const schemas = await page.evaluate(() =>
      Object.values((window as any).__webmcpTools).map((t: any) => ({
        name: t.name,
        type: t.inputSchema?.type,
        described: typeof t.description === 'string' && t.description.length > 20,
      })),
    );
    for (const s of schemas) {
      expect(s.type, `${s.name} needs an object schema`).toBe('object');
      expect(s.described, `${s.name} needs a description`).toBe(true);
    }
  });

  test('open a buffer, read its text, export it — through the tools only', async ({ page }) => {
    await page.goto('/editor?new=docx');
    await expect
      .poll(() => page.evaluate(() => Object.keys((window as any).__webmcpTools ?? {})), { timeout: 60_000 })
      .toContain('open_document_buffer');

    const opened = await callTool(page, 'open_document_buffer', {
      fileName: 'agent.docx',
      base64: toBase64(buildDocx('WebMCP first paragraph and WebMCP second paragraph')),
    });
    expect(opened.isError).toBe(false);
    expect(opened.data).toMatchObject({ ok: true, fileName: 'agent.docx' });

    await waitForEditorReady(page);
    expect((await callTool(page, 'get_document_state')).data.hasDocument).toBe(true);

    // The reason this tool exists: answer about the content without exporting.
    await expect
      .poll(async () => (await callTool(page, 'get_document_text')).data.text, { timeout: 120_000 })
      .toContain('WebMCP first paragraph');
    const text = await callTool(page, 'get_document_text');
    expect(text.data.supported).toBe(true);
    expect(text.data.text).toContain('WebMCP second paragraph');

    // Results must be JSON-serialisable: a File would not survive the boundary.
    const saved = await callTool(page, 'save_document', { targetExt: 'PDF' });
    expect(saved.isError).toBe(false);
    expect(saved.data.fileName).toBe('agent.pdf');
    expect(saved.data.size).toBeGreaterThan(0);
    expect(String(saved.data.blobUrl)).toMatch(/^blob:/);
    expect(String(saved.data.dataUrl ?? '')).toMatch(/^data:/);
  });

  test('create_document starts each kind, and rejects one it does not know', async ({ page }) => {
    await page.goto('/editor?new=docx');
    await expect
      .poll(() => page.evaluate(() => Object.keys((window as any).__webmcpTools ?? {})), { timeout: 60_000 })
      .toContain('create_document');

    const made = await callTool(page, 'create_document', { kind: 'spreadsheet' });
    expect(made.isError).toBe(false);
    expect(String(made.data.fileName)).toMatch(/\.xlsx$/);

    await waitForEditorReady(page);
    expect((await callTool(page, 'get_document_state')).data.hasDocument).toBe(true);

    const bad = await callTool(page, 'create_document', { kind: 'novel' });
    expect(bad.isError).toBe(true);
    expect(String(bad.data.error)).toMatch(/kind must be one of/);
  });

  /**
   * A spreadsheet has no full-text read on this engine. The tool must say that
   * rather than return an empty string, which an agent would read as "the file
   * is empty" and answer confidently from.
   */
  test('get_document_text says so when the format has no full text', async ({ page }) => {
    await page.goto('/editor?new=xlsx');
    await expect
      .poll(() => page.evaluate(() => Object.keys((window as any).__webmcpTools ?? {})), { timeout: 60_000 })
      .toContain('get_document_text');
    // `hasDocument` only reports that window.editor exists, which happens before
    // the document has finished loading -- reading text that early throws inside
    // the tool and answers isError, not a verdict about the format.
    await waitForEditorReady(page);

    const read = await callTool(page, 'get_document_text');
    expect(read.isError).toBe(false);
    expect(read.data.supported).toBe(false);
    expect(String(read.data.note)).toMatch(/save_document/);
  });

  /**
   * Registration is deliberately top-level only: a cross-origin iframe would
   * need the parent's `allow="tools"`, which collides with the embed use case.
   */
  test('does not register inside an embedded frame', async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
    const inFrame = await page.evaluate(() => {
      const frame = document.querySelector('iframe');
      const win = frame?.contentWindow as unknown as { __webmcpTools?: Record<string, unknown> } | null;
      try {
        return Object.keys(win?.__webmcpTools ?? {});
      } catch {
        return ['<cross-origin>'];
      }
    });
    expect(inFrame).toEqual([]);
  });
});
