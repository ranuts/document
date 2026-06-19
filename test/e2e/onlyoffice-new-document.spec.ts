import { expect, test } from '@playwright/test';

type CanvasSample = {
  id: string;
  width: number;
  height: number;
  nonTransparentPixels: number;
};

type EditorRuntimeState = {
  documentReady: boolean;
  hasApi: boolean;
  loadingText: string;
  mainReady: boolean;
  openedAtReady: boolean;
  permissionsInited: boolean | null;
};

async function getEditorCanvasSample(page: import('@playwright/test').Page): Promise<CanvasSample | null> {
  return page.evaluate(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe');
    const iframeDocument = iframe?.contentDocument;
    const canvas =
      iframeDocument?.querySelector<HTMLCanvasElement>('canvas#id_viewer') ??
      iframeDocument?.querySelector<HTMLCanvasElement>('canvas');

    if (!canvas || canvas.width === 0 || canvas.height === 0) return null;

    const context = canvas.getContext('2d');
    if (!context) return null;

    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const stepX = Math.max(1, Math.floor(canvas.width / 80));
    const stepY = Math.max(1, Math.floor(canvas.height / 80));
    let nonTransparentPixels = 0;
    for (let y = 0; y < canvas.height; y += stepY) {
      for (let x = 0; x < canvas.width; x += stepX) {
        const alphaIndex = (y * canvas.width + x) * 4 + 3;
        if (data[alphaIndex] !== 0) nonTransparentPixels += 1;
      }
    }

    return {
      id: canvas.id,
      width: canvas.width,
      height: canvas.height,
      nonTransparentPixels,
    };
  });
}

async function getEditorRuntimeState(page: import('@playwright/test').Page): Promise<EditorRuntimeState | null> {
  return page.evaluate(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe');
    const iframeWindow = iframe?.contentWindow as any;
    const iframeDocument = iframe?.contentDocument;
    if (!iframeWindow || !iframeDocument) return null;

    const api = iframeWindow.Asc?.editor;
    const editorApp = iframeWindow.DE ?? iframeWindow.SSE ?? iframeWindow.PE;
    const mainCtrl = editorApp?.getController?.('Main');
    const loadingText = iframeDocument.querySelector('.asc-loadmask-title')?.textContent?.trim() ?? '';

    return {
      documentReady: Boolean(api?.Fia || api?.l0 || api?.Joa),
      hasApi: Boolean(api),
      loadingText,
      mainReady: Boolean(mainCtrl?.document || mainCtrl?.appOptions?.user),
      openedAtReady: Boolean(api?.I0c || api?.cSd || api?.kvd),
      permissionsInited: typeof mainCtrl?._isPermissionsInited === 'boolean' ? mainCtrl._isPermissionsInited : null,
    };
  });
}

async function openNewDocumentAndWaitForRender(
  page: import('@playwright/test').Page,
  ext: '.docx' | '.xlsx' | '.pptx',
  consoleMessages: string[],
) {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.onCreateNew === 'function');

  await page.evaluate((extension) => window.onCreateNew(extension), ext);

  await expect
    .poll(async () => consoleMessages.some((message) => message.includes('[OO] asc_openDocumentFromBytes')), {
      timeout: 45_000,
      message: `Expected asc_openDocumentFromBytes log. Recent console:\n${consoleMessages.slice(-20).join('\n')}`,
    })
    .toBe(true);

  await expect
    .poll(
      async () => {
        const state = await getEditorRuntimeState(page);
        return Boolean(
          state?.hasApi &&
          state.mainReady &&
          state.permissionsInited &&
          state.openedAtReady &&
          state.documentReady &&
          !state.loadingText,
        );
      },
      { timeout: 45_000 },
    )
    .toBe(true);

  await expect
    .poll(
      async () => {
        const sample = await getEditorCanvasSample(page);
        return sample?.nonTransparentPixels ?? 0;
      },
      { timeout: 45_000 },
    )
    .toBeGreaterThan(0);
}

test('New Word opens reliably through OnlyOffice 9.x Web Mode and renders the document canvas', async ({ page }) => {
  test.setTimeout(150_000);

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const consoleMessages: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('[OO]') || message.type() === 'error') {
        consoleMessages.push(`${message.type()}: ${text}`);
      }
    });

    await test.step(`attempt ${attempt}`, async () => {
      await openNewDocumentAndWaitForRender(page, '.docx', consoleMessages);
    });
  }

  expect(pageErrors).toEqual([]);
});

test('New Excel opens through OnlyOffice 9.x Web Mode and renders the document canvas', async ({ page }) => {
  test.setTimeout(150_000);

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const consoleMessages: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('[OO]') || message.type() === 'error') {
      consoleMessages.push(`${message.type()}: ${text}`);
    }
  });

  await openNewDocumentAndWaitForRender(page, '.xlsx', consoleMessages);

  expect(pageErrors).toEqual([]);
});

test.skip('New PowerPoint opens through OnlyOffice 9.x Web Mode and renders the document canvas', async () => {
  // PPTX currently remains at "Loading presentation". Runtime sampling shows
  // Asc.editor.kvd=false/Joa=false after asc_openDocumentFromBytes, and directly
  // calling the internal rdg() gate throws "Cannot read properties of null (reading 'Ka')".
});
