import { devices } from '@playwright/test';
import { expect, test } from './lib/l0';

/**
 * Presentations on a phone (GitHub #145: "slide in android chrome init zoom is
 * 31%; after several times change zoom value; will be show error").
 *
 * Only the vendor's desktop ("main") bundle carries this package's offline x2t
 * patch, so a phone gets the desktop UI. Its fixed chrome used to leave a
 * ~190 px strip of a 393 px viewport for the slide, and "fit" then computed a
 * zoom in the low tens of percent. lib/onlyoffice-editor.ts now drops the
 * right panel, the rulers and the notes pane on compact viewports and
 * collapses the slide thumbnails (reopenable from the left rail), which
 * roughly doubles both numbers.
 *
 * The second half of the report -- a blank editor after repeated zoom changes
 * -- matches a discarded canvas backing store, which mobile Chrome does under
 * memory pressure and which this vendor build does not handle at all. Guard 9
 * repaints on contextlost/contextrestored; the last test drives those events
 * directly, since a real eviction cannot be provoked on demand.
 */
// Pixel 5 carries `defaultBrowserType: 'chromium'`, so this file launches
// Chromium under every project -- including the nightly's webkit/firefox ones,
// which do not install it. The per-describe guards below therefore key on the
// project name, not on `browserName` (which this line makes read 'chromium').
test.use({ ...devices['Pixel 5'] });

// Installed in every frame before any page script: the editor lives in a
// same-origin iframe, and each test needs its window to read the SDK state.
const INSTALL_FRAME_FINDER = () => {
  (window as any).__findEditorFrame = () => {
    const visit = (win: Window): Window | null => {
      try {
        const api = (win as any).Asc?.editor;
        if (api && 'isDocumentLoadComplete' in api) return win;
      } catch {
        /* cross-origin */
      }
      for (let i = 0; i < win.frames.length; i++) {
        const found = visit(win.frames[i]);
        if (found) return found;
      }
      return null;
    };
    return visit(window);
  };
};

test.describe('presentation on a phone-sized viewport (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });
  test.skip(({ projectName }) => projectName !== 'chromium', 'device emulation needs chromium');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(INSTALL_FRAME_FINDER);
    await page.goto('/editor?new=pptx');
    await page.waitForFunction(
      () => {
        const visit = (win: Window): boolean => {
          try {
            if ((win as any).Asc?.editor?.isDocumentLoadComplete) return true;
          } catch {
            /* cross-origin */
          }
          for (let i = 0; i < win.frames.length; i++) if (visit(win.frames[i])) return true;
          return false;
        };
        return visit(window);
      },
      null,
      { timeout: 150_000 },
    );
  });

  test('the slide gets the viewport instead of the side panels', async ({ page }) => {
    const layout = await page.evaluate(() => {
      const win = (window as any).__findEditorFrame() as Window | null;
      if (!win) throw new Error('editor frame not found');
      const api = (win as any).Asc.editor;
      const width = (selector: string) =>
        Math.round(win.document.querySelector(selector)?.getBoundingClientRect().width ?? 0);
      return {
        viewport: win.innerWidth,
        canvas: width('#id_viewer'),
        rightMenu: width('[data-layout-name="rightMenu"]'),
        zoom: api.WordControl?.m_nZoomValue ?? 0,
      };
    });

    // Before the compact layout: 191 px of canvas and 12 % zoom on this
    // viewport, i.e. the slide was a thumbnail in the middle of the screen.
    expect(layout.canvas).toBeGreaterThan(layout.viewport * 0.75);
    expect(layout.zoom).toBeGreaterThanOrEqual(20);
    expect(layout.rightMenu).toBe(0);
  });

  test('changing the zoom repeatedly keeps the slide rendered and raises no error', async ({ page, l0 }) => {
    const result = await page.evaluate(async () => {
      const win = (window as any).__findEditorFrame() as Window | null;
      if (!win) throw new Error('editor frame not found');
      const api = (win as any).Asc.editor;
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const zooms: number[] = [];
      for (const step of ['zoomIn', 'zoomIn', 'zoomIn', 'zoomOut', 'zoomFitToPage', 'zoomIn', 'zoom100', 'zoomOut']) {
        api[step]();
        await wait(250);
        zooms.push(api.WordControl?.m_nZoomValue ?? 0);
      }
      // The slide must still be drawn: a blank canvas is the failure users see.
      const canvas = win.document.getElementById('id_viewer') as HTMLCanvasElement;
      const context = canvas.getContext('2d')!;
      const pixels = context.getImageData(0, 0, Math.min(canvas.width, 300), Math.min(canvas.height, 300)).data;
      let painted = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 240 || pixels[i + 1] < 240 || pixels[i + 2] < 240) painted++;
      }
      return {
        zooms,
        inkPercent: Math.round((painted / (pixels.length / 4)) * 1000) / 10,
        dialog: win.document.querySelector('.asc-window.modal.alert')?.textContent?.trim() ?? null,
      };
    });

    expect(result.zooms.every((zoom) => zoom > 0)).toBe(true);
    expect(result.inkPercent).toBeGreaterThan(0);
    expect(result.dialog).toBeNull();
    expect(await l0.ascErrors()).toEqual([]);
  });

  test('a lost canvas context is repainted instead of leaving a blank editor', async ({ page }) => {
    const recovery = await page.evaluate(async () => {
      const win = (window as any).__findEditorFrame() as Window | null;
      if (!win) throw new Error('editor frame not found');
      const canvas = win.document.getElementById('id_viewer') as HTMLCanvasElement;
      const context = canvas.getContext('2d')!;
      const ink = () => {
        const pixels = context.getImageData(0, 0, Math.min(canvas.width, 300), Math.min(canvas.height, 300)).data;
        let painted = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] < 240 || pixels[i + 1] < 240 || pixels[i + 2] < 240) painted++;
        }
        return Math.round((painted / (pixels.length / 4)) * 1000) / 10;
      };
      const before = ink();
      // What a discarded backing store leaves behind.
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const wiped = ink();
      canvas.dispatchEvent(new Event('contextlost'));
      canvas.dispatchEvent(new Event('contextrestored'));
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return { before, wiped, after: ink() };
    });

    expect(recovery.before).toBeGreaterThan(0);
    expect(recovery.wiped).toBe(0);
    expect(recovery.after).toBeGreaterThan(0);
  });

  test('a phone held in landscape counts as compact, and still does after rotating', async ({ page }) => {
    // A phone in landscape is ~850 px wide, so a width-only breakpoint would
    // mount the full desktop chrome and rotating would land straight back in
    // #145's layout (measured then: 191 px of canvas, 12 % zoom). The compact
    // rule looks at the shorter side on touch devices, so both orientations
    // are covered.
    await page.setViewportSize({ width: 851, height: 393 });
    await page.reload();
    await page.waitForFunction(
      () => {
        const visit = (win: Window): boolean => {
          try {
            if ((win as any).Asc?.editor?.isDocumentLoadComplete) return true;
          } catch {
            /* cross-origin */
          }
          for (let i = 0; i < win.frames.length; i++) if (visit(win.frames[i])) return true;
          return false;
        };
        return visit(window);
      },
      null,
      { timeout: 150_000 },
    );

    await page.setViewportSize({ width: 393, height: 851 });
    // The follow is debounced (mobile fires resize on every URL-bar frame).
    await page.waitForTimeout(1_500);

    const layout = await page.evaluate(() => {
      const win = (window as any).__findEditorFrame() as Window | null;
      if (!win) throw new Error('editor frame not found');
      const api = (win as any).Asc.editor;
      const width = (selector: string) =>
        Math.round(win.document.querySelector(selector)?.getBoundingClientRect().width ?? 0);
      return {
        viewport: win.innerWidth,
        canvas: width('#id_viewer'),
        thumbnails: width('#id_thumbnails'),
        rightMenu: width('[data-layout-name="rightMenu"]'),
        zoom: api.WordControl?.m_nZoomValue ?? 0,
      };
    });

    expect(layout.viewport).toBe(393);
    expect(layout.canvas).toBeGreaterThan(layout.viewport * 0.75);
    expect(layout.thumbnails).toBe(0);
    expect(layout.rightMenu).toBe(0);
    expect(layout.zoom).toBeGreaterThanOrEqual(20);
  });
});

/**
 * The same document types on the same phone: the compact chrome is not a
 * presentation-only concern (the reporter's case was a deck, but a spreadsheet
 * or a document on a phone loses the same panels to the same chrome).
 */
test.describe('other formats on a phone-sized viewport (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });
  test.skip(({ projectName }) => projectName !== 'chromium', 'device emulation needs chromium');

  for (const { type, canvas } of [
    { type: 'docx', canvas: '#id_viewer' },
    { type: 'xlsx', canvas: '#ws-canvas' },
  ]) {
    test(`${type} uses the width instead of the side panels`, async ({ page }) => {
      await page.addInitScript(INSTALL_FRAME_FINDER);
      await page.goto(`/editor?new=${type}`);
      await page.waitForFunction(
        () => {
          const visit = (win: Window): boolean => {
            try {
              if ((win as any).Asc?.editor?.isDocumentLoadComplete) return true;
            } catch {
              /* cross-origin */
            }
            for (let i = 0; i < win.frames.length; i++) if (visit(win.frames[i])) return true;
            return false;
          };
          return visit(window);
        },
        null,
        { timeout: 150_000 },
      );

      const layout = await page.evaluate((canvasSelector) => {
        const win = (window as any).__findEditorFrame() as Window | null;
        if (!win) throw new Error('editor frame not found');
        const width = (selector: string) =>
          Math.round(win.document.querySelector(selector)?.getBoundingClientRect().width ?? 0);
        return {
          viewport: win.innerWidth,
          canvas: width(canvasSelector),
          rightMenu: width('[data-layout-name="rightMenu"]'),
        };
      }, canvas);

      expect(layout.canvas).toBeGreaterThan(layout.viewport * 0.75);
      expect(layout.rightMenu).toBe(0);
    });
  }
});

/**
 * The crossing the mount-time decision cannot make: an editor that is already
 * open when the viewport becomes phone-sized (a narrowed desktop window, a
 * split screen). installViewportFollow is what adapts it live.
 */
test.describe('viewport follow on a live editor (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });
  test.skip(({ projectName }) => projectName !== 'chromium', 'device emulation needs chromium');
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test('narrowing a desktop window into a phone-sized one adapts the open document', async ({ page }) => {
    await page.addInitScript(INSTALL_FRAME_FINDER);
    await page.goto('/editor?new=pptx');
    await page.waitForFunction(
      () => {
        const visit = (win: Window): boolean => {
          try {
            if ((win as any).Asc?.editor?.isDocumentLoadComplete) return true;
          } catch {
            /* cross-origin */
          }
          for (let i = 0; i < win.frames.length; i++) if (visit(win.frames[i])) return true;
          return false;
        };
        return visit(window);
      },
      null,
      { timeout: 150_000 },
    );

    const read = () =>
      page.evaluate(() => {
        const win = (window as any).__findEditorFrame() as Window | null;
        if (!win) throw new Error('editor frame not found');
        const api = (win as any).Asc.editor;
        const width = (selector: string) =>
          Math.round(win.document.querySelector(selector)?.getBoundingClientRect().width ?? 0);
        return {
          viewport: win.innerWidth,
          canvas: width('#id_viewer'),
          thumbnails: width('#id_thumbnails'),
          rightMenu: width('[data-layout-name="rightMenu"]'),
          notesShown: api.getIsNotesShow?.() ?? null,
        };
      });

    // Mounted wide: the desktop layout, every panel in place.
    const wide = await read();
    expect(wide.thumbnails).toBeGreaterThan(0);
    expect(wide.rightMenu).toBeGreaterThan(0);

    await page.setViewportSize({ width: 393, height: 900 });
    // The follow is debounced -- mobile browsers fire resize on every URL-bar frame.
    await page.waitForTimeout(1_500);

    const narrow = await read();
    expect(narrow.viewport).toBe(393);
    expect(narrow.thumbnails).toBe(0);
    expect(narrow.rightMenu).toBe(0);
    expect(narrow.notesShown).toBe(false);
    expect(narrow.canvas).toBeGreaterThan(narrow.viewport * 0.75);

    // Widening again gives the panels back: everything folded here was ours
    // to unfold. The right panel is the one that used to be a one-way door --
    // hiding it through customization.layout wrote an inline display:none that
    // no media query could undo, so a document opened in a narrow window lost
    // its object settings for good.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(1_500);
    const wideAgain = await read();
    expect(wideAgain.thumbnails).toBeGreaterThan(0);
    expect(wideAgain.rightMenu).toBeGreaterThan(0);
    expect(wideAgain.notesShown).toBe(true);
  });

  test('a document opened in a narrow window gets its panels back when it is widened', async ({ page }) => {
    // The mirror of the test above, and the one that catches a one-way fold:
    // here the editor MOUNTS compact, so anything applied through the vendor's
    // mount-time customization is applied for good. `layout: { rightMenu:
    // false }` used to be applied that way and left the object-settings panel
    // hidden by an inline style that widening could never undo.
    await page.setViewportSize({ width: 400, height: 900 });
    await page.addInitScript(INSTALL_FRAME_FINDER);
    await page.goto('/editor?new=pptx');
    await page.waitForFunction(
      () => {
        const visit = (win: Window): boolean => {
          try {
            if ((win as any).Asc?.editor?.isDocumentLoadComplete) return true;
          } catch {
            /* cross-origin */
          }
          for (let i = 0; i < win.frames.length; i++) if (visit(win.frames[i])) return true;
          return false;
        };
        return visit(window);
      },
      null,
      { timeout: 150_000 },
    );

    const read = () =>
      page.evaluate(() => {
        const win = (window as any).__findEditorFrame() as Window | null;
        if (!win) throw new Error('editor frame not found');
        const width = (selector: string) =>
          Math.round(win.document.querySelector(selector)?.getBoundingClientRect().width ?? 0);
        return {
          viewport: win.innerWidth,
          rightMenu: width('[data-layout-name="rightMenu"]'),
          thumbnails: width('#id_thumbnails'),
        };
      });

    const narrow = await read();
    expect(narrow.rightMenu).toBe(0);
    expect(narrow.thumbnails).toBe(0);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(1_500);

    const wide = await read();
    expect(wide.viewport).toBe(1280);
    expect(wide.rightMenu).toBeGreaterThan(0);
    expect(wide.thumbnails).toBeGreaterThan(0);
  });
});
