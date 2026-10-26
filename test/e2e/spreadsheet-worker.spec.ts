import { expect, test } from './lib/l0';

test('large spreadsheet conversion leaves the main thread responsive and round trips Unicode', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/history');
  const result = await page.evaluate(async () => {
    const convert = (operation: string, data: string | ArrayBuffer): Promise<ArrayBuffer> =>
      new Promise((resolve, reject) => {
        const worker = new Worker('/libs/sheetjs/convert.worker.js');
        worker.onmessage = (event) => {
          worker.terminate();
          if (event.data.ok) resolve(event.data.data);
          else reject(new Error(event.data.error));
        };
        worker.onerror = (event) => {
          worker.terminate();
          reject(new Error(event.message));
        };
        worker.postMessage({ operation, data });
      });
    const input = 'name,value\n' + Array.from({ length: 50000 }, (_, i) => `项目${i},${i}`).join('\n');
    let ticks = 0;
    const timer = setInterval(() => ticks++, 10);
    try {
      const xlsx = await convert('csv-to-xlsx', input);
      const conversionTicks = ticks;
      const csv = new TextDecoder().decode(await convert('xlsx-to-csv', xlsx));
      const html = await convert('html-to-xlsx', '<table><tr><td>中文</td><td>12</td></tr></table>');
      return {
        ticks: conversionTicks,
        first: csv.includes('项目0,0'),
        last: csv.includes('项目49999,49999'),
        htmlBytes: html.byteLength,
      };
    } finally {
      clearInterval(timer);
    }
  });
  expect(result.ticks).toBeGreaterThan(1);
  expect(result.first).toBe(true);
  expect(result.last).toBe(true);
  expect(result.htmlBytes).toBeGreaterThan(100);
});

test('first spreadsheet conversion is available offline after app preparation', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  try {
    const magic = await page.evaluate(
      () =>
        new Promise<number[]>((resolve, reject) => {
          const worker = new Worker('/libs/sheetjs/convert.worker.js');
          worker.onmessage = (event) => {
            worker.terminate();
            if (!event.data.ok) reject(new Error(event.data.error));
            else resolve([...new Uint8Array(event.data.data).slice(0, 2)]);
          };
          worker.onerror = (event) => {
            worker.terminate();
            reject(new Error(event.message));
          };
          worker.postMessage({ operation: 'csv-to-xlsx', data: 'name,value\n离线,12' });
        }),
    );
    expect(magic).toEqual([0x50, 0x4b]);
  } finally {
    await context.setOffline(false);
  }
});
