import { expect, test } from './lib/l0';

for (const extension of ['docx', 'xlsx', 'pptx']) {
  test(`${extension}: opens under the strict editor policy without blocked event handlers`, async ({ page }) => {
    await page.addInitScript(() => {
      const violations: string[] = [];
      Object.assign(window, { __editorCspViolations: violations });
      document.addEventListener('securitypolicyviolation', (event) => {
        violations.push(`${event.effectiveDirective}: ${event.sourceFile}:${event.lineNumber}`);
      });
    });
    // The plain Vite suite omits the deploy-only HTML stamp. Enforce the same
    // event-attribute restriction here while retaining any host policy.
    await page.route(/\/editor(?:\.html)?(?:\?|$)/, async (route) => {
      const response = await route.fetch();
      const headers = response.headers();
      await route.fulfill({
        response,
        headers: {
          ...headers,
          'content-security-policy': [headers['content-security-policy'], "script-src-attr 'none'"]
            .filter(Boolean)
            .join(', '),
        },
      });
    });
    await page.goto(`/editor?new=${extension}`);
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()), undefined, { timeout: 60_000 });
    const result = await page.evaluate(() => ({
      violations: (window as unknown as { __editorCspViolations: string[] }).__editorCspViolations,
    }));
    expect(result.violations).toEqual([]);
  });
}
