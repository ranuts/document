import { expect, test } from './lib/l0';

for (const entry of ['programmatic', 'sidebar'] as const) {
  test(`${entry}: native deferred editor focus preserves the assistant composer until explicit editor input`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.addInitScript(() => {
      localStorage.setItem('document-assistant-enabled', 'true');
      localStorage.setItem(
        'agent-writing-endpoint',
        JSON.stringify({ version: 1, kind: 'loopback', baseUrl: 'http://localhost:11434', model: 'focus-test' }),
      );
    });
    await page.goto('/editor?new=docx&locale=en');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    const frame = page.frameLocator('iframe[name="frameEditor"]');
    if (entry === 'programmatic') await page.evaluate(() => window.__toggleAgentPanel?.());
    else await frame.locator('.agent-sidebar-entry').click();
    const input = page.locator('.cui-input');
    await expect(input).toBeFocused();

    // DocumentHolder's deferred completion focuses this exact SDK element.
    // Wait for its native Firefox focus callback as well, rather than racing
    // an assertion ahead of the callback that originally redirected typing.
    const deferredFocus = () =>
      page.evaluate(async () => {
        const win = window.__ooFrames.readyEditor()!;
        const target = win.document.getElementById('editor_sdk')!;
        target.focus();
        await new Promise<void>((resolve) => win.setTimeout(resolve, 0));
        return target.id;
      });
    expect(await deferredFocus()).toBe('editor_sdk');
    await expect(input).toBeFocused();
    await input.fill('Keep this request in the assistant');
    expect(await deferredFocus()).toBe('editor_sdk');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Keep this request in the assistant');

    // A real editor click releases the claim; native document input must still
    // work while the assistant remains open.
    await frame.locator('#editor_sdk').click({ position: { x: 300, y: 200 } });
    await expect(input).not.toBeFocused();
    await page.keyboard.type('Document handoff stays usable');
    const documentText = () =>
      page.evaluate(() => {
        const win = window.__ooFrames.readyEditor() as any;
        const logic = (win.Asc?.editor ?? win.editor).WordControl.m_oLogicDocument;
        const paragraphs: any[] = [];
        for (const element of logic.Content) element.GetAllParagraphs({ All: true }, paragraphs);
        return paragraphs.map((paragraph) => paragraph.GetText({ Numbering: false })).join('\n');
      });
    await expect.poll(documentText).toContain('Document handoff stays usable');
    expect(await documentText()).not.toContain('Keep this request in the assistant');

    // Returning through a genuine parent pointer interaction claims the
    // composer again, including when the editor already owns native focus.
    await input.click();
    expect(await deferredFocus()).toBe('editor_sdk');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Keep this request in the assistant');

    // The native window manager must still focus actionable dialogs; the
    // document refocus guard must not trap their keyboard controls outside.
    await page.evaluate(() => {
      const win = window.__ooFrames.readyEditor() as any;
      win.Common.UI.alert({ title: 'Native focus boundary', msg: 'A native modal keeps its keyboard focus.' });
    });
    const dialog = frame.locator('.asc-window').filter({ hasText: 'Native focus boundary' });
    const ok = dialog.getByRole('button', { name: 'OK', exact: true });
    await expect(ok).toBeFocused();
    await ok.click();
    await expect(dialog).toBeHidden();
  });
}
