import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Legacy-encoded CSV end to end (matrix section B "编码"): Excel on zh-CN
 * Windows exports CSV in the ANSI code page (GBK). The converter's sniff
 * (fatal UTF-8 -> GB18030 -> latin1) is unit-tested; this pins the whole
 * path through the real editor: open, save back as CSV, text intact.
 */
test.describe('GBK CSV (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('opens a GBK-encoded CSV and saves it back with the Chinese cells intact', async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    // "姓名,分数\n李雷,90\n韩梅梅,85" in GBK. 姓=D0D5 名=C3FB 李=C0EE 雷=C0D7 韩=BAAB 梅=C3B7
    const gbk = Buffer.from([
      0xd0,
      0xd5,
      0xc3,
      0xfb,
      0x2c,
      0xb7,
      0xd6,
      0xca,
      0xfd,
      0x0a, // 姓名,分数\n
      0xc0,
      0xee,
      0xc0,
      0xd7,
      0x2c,
      0x39,
      0x30,
      0x0a, // 李雷,90\n
      0xba,
      0xab,
      0xc3,
      0xb7,
      0xc3,
      0xb7,
      0x2c,
      0x38,
      0x35, // 韩梅梅,85
    ]).toString('base64');

    const result = await page.evaluate(async (b64) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await post('document:open-buffer', {
        fileName: 'gbk.csv',
        buffer: bytes.buffer,
        mimeType: 'text/csv',
        readonly: false,
      });
      const saved = await post('document:save', {});
      return { name: saved.file.name as string, type: saved.file.type as string, text: await saved.file.text() };
    }, gbk);

    expect(result.name).toBe('gbk.csv');
    expect(result.type).toBe('text/csv');
    expect(result.text.replace(/^﻿/, '').trim()).toBe('姓名,分数\n李雷,90\n韩梅梅,85');
  });
});
