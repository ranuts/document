import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch();
const report = { scope: 'Minimal harness semantics control; an async false result must not establish readiness.' };
try {
  const page = await browser.newPage();
  const began = Date.now();
  const handle = await page.waitForFunction(async () => false, null, { timeout: 1000 });
  report.returnedValue = await handle.jsonValue();
  report.elapsedMs = Date.now() - began;
  report.explicitPollingRejectedFalse = false;
  try {
    await expect.poll(() => page.evaluate(async () => false), { timeout: 150, intervals: [25] }).toBe(true);
  } catch {
    report.explicitPollingRejectedFalse = true;
  }
  if (report.returnedValue !== false || !report.explicitPollingRejectedFalse)
    throw Error('Unexpected polling semantics');
} finally {
  await browser.close();
  await fs.writeFile(
    'docs/evaluations/2026-10-03-playwright-async-predicate-control.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
