import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Embed-mode E2E tests
//
// In non-iframe context window.parent === window, so postToParent() dispatches
// to the same window. page.evaluate() Promises and addInitScript() can
// observe these messages.
// ---------------------------------------------------------------------------

test.describe('embed mode activation', () => {
  test('adds embed-mode class to body when ?embed=1 is present', async ({ page }) => {
    await page.goto('/?embed=1');
    await expect(page.locator('body')).toHaveClass(/embed-mode/);
  });

  test('does NOT add embed-mode class without embed query param', async ({ page }) => {
    await page.goto('/');
    const classes = await page.locator('body').getAttribute('class');
    expect(classes ?? '').not.toContain('embed-mode');
  });

  test('activates embed mode with ?embed=true', async ({ page }) => {
    await page.goto('/?embed=true');
    await expect(page.locator('body')).toHaveClass(/embed-mode/);
  });

  test('activates embed mode with ?embedded=1', async ({ page }) => {
    await page.goto('/?embedded=1');
    await expect(page.locator('body')).toHaveClass(/embed-mode/);
  });
});

test.describe('postMessage API', () => {
  test('document:ready is posted after the page loads', async ({ page }) => {
    // addInitScript runs before page scripts, so it captures messages
    // dispatched during and after page load.
    await page.addInitScript(() => {
      (window as any).__capturedMessages = [] as unknown[];
      window.addEventListener('message', (e: MessageEvent) => {
        (window as any).__capturedMessages.push(e.data);
      });
    });

    await page.goto('/?embed=1');
    // Give a tick for async postMessage dispatch
    await page.waitForTimeout(200);

    const messages = await page.evaluate(() => (window as any).__capturedMessages as Array<{ type?: string }>);
    expect(messages.some((m) => m.type === 'document:ready')).toBe(true);
  });

  test('responds to document:get-state with readonly and hasDocument flags', async ({ page }) => {
    await page.goto('/?embed=1');

    const response = await page.evaluate(
      () =>
        new Promise<{ type: string; payload: Record<string, unknown> }>((resolve) => {
          window.addEventListener('message', (e: MessageEvent) => {
            const msg = e.data as { type?: string; id?: string; payload?: Record<string, unknown> };
            // Filter for the response only (type differs from the request we sent)
            if (msg?.type === 'document:state' && msg?.id === 'e2e-state-1') resolve(msg as any);
          });
          window.postMessage({ type: 'document:get-state', id: 'e2e-state-1' }, '*');
        }),
    );

    expect(response.type).toBe('document:state');
    expect(typeof response.payload.readonly).toBe('boolean');
    expect(typeof response.payload.hasDocument).toBe('boolean');
  });

  test('document:set-readonly changes readonly state', async ({ page }) => {
    await page.goto('/?embed=1');

    // Query initial state
    const before = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          window.addEventListener('message', (e: MessageEvent) => {
            const msg = e.data as { type?: string; id?: string; payload?: { readonly?: boolean } };
            if (msg?.type === 'document:state' && msg?.id === 'e2e-before') resolve(msg.payload?.readonly ?? false);
          });
          window.postMessage({ type: 'document:get-state', id: 'e2e-before' }, '*');
        }),
    );
    expect(before).toBe(false);

    // Set readonly = true
    const after = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          window.addEventListener('message', (e: MessageEvent) => {
            const msg = e.data as { type?: string; id?: string; payload?: { readonly?: boolean } };
            if (msg?.type === 'document:readonly-changed' && msg?.id === 'e2e-ro-set')
              resolve(msg.payload?.readonly ?? false);
          });
          window.postMessage({ type: 'document:set-readonly', id: 'e2e-ro-set', payload: { readonly: true } }, '*');
        }),
    );
    expect(after).toBe(true);
  });

  test('embedOrigin param blocks messages from a mismatched origin', async ({ page }) => {
    // page.evaluate postMessage has origin http://127.0.0.1:4173 (same origin),
    // which does NOT match the allowed 'https://allowed.example.com',
    // so the message handler should be skipped and no response received.
    await page.goto('/?embed=1&embedOrigin=https://allowed.example.com');

    const blocked = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          let received = false;
          window.addEventListener('message', (e: MessageEvent) => {
            const msg = e.data as { type?: string; id?: string };
            // Only count the *response* from the app, not the request we sent
            if (msg?.type === 'document:state' && msg?.id === 'e2e-blocked') received = true;
          });
          window.postMessage({ type: 'document:get-state', id: 'e2e-blocked' }, '*');
          // Wait 500 ms; if no matching response arrives the message was blocked.
          setTimeout(() => resolve(!received), 500);
        }),
    );

    expect(blocked).toBe(true);
  });
});
