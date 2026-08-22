#!/usr/bin/env node
/**
 * How long does one autosave snapshot actually cost?
 *
 * The snapshot interval (lib/history/autosave.ts) was picked without data: an
 * export is a full SDK serialisation plus an x2t conversion behind a 283 MB
 * heap request, which is expensive enough that "every few keystrokes" is
 * obviously wrong, and that is all anyone knew. This measures it, so the
 * interval can be an argument rather than a guess.
 *
 * What it reports, per document shape:
 *   first  -- the first export of a session, which pays for loading x2t
 *   warm   -- every export after that, i.e. what an autosave snapshot costs
 *   bytes  -- what a snapshot occupies in the local history
 *
 * Run against any server for the built site:
 *   pnpm run build && pnpm run preview      # or E2E_PORT=... playwright's
 *   node bin/export-benchmark.mjs [baseUrl] [runs] [cpuThrottle]
 *
 * The third argument slows the CPU by that factor through the DevTools
 * protocol -- 4x and 6x are the usual stand-ins for a mid-range and a low-end
 * phone. That matters here because the snapshot interval is derived from the
 * export time, so a slow device is supposed to ask for snapshots less often;
 * this is how that claim gets checked without owning the hardware.
 *
 * Read-only: opens documents through the embed API and exports them. Nothing
 * is written anywhere.
 */
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4173';
const RUNS = Number(process.argv[3] ?? 3);
const CPU_THROTTLE = Number(process.argv[4] ?? 1);

/** Document shapes worth separating: the cost is driven by content, not format alone. */
const SHAPES = [
  { name: 'docx, one paragraph', kind: 'docx', paragraphs: 1 },
  { name: 'docx, 200 paragraphs', kind: 'docx', paragraphs: 200 },
  { name: 'docx, 2000 paragraphs', kind: 'docx', paragraphs: 2000 },
  { name: 'xlsx, 1k rows', kind: 'xlsx', rows: 1000 },
  { name: 'xlsx, 20k rows', kind: 'xlsx', rows: 20000 },
];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

const browser = await chromium.launch();
const rows = [];

for (const shape of SHAPES) {
  const context = await browser.newContext();
  const page = await context.newPage();
  if (CPU_THROTTLE > 1) {
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  }
  await page.goto(`${base}/embed-demo.html`);
  await page.waitForSelector('#status:has-text("ready")', { timeout: 60_000 });

  const result = await page.evaluate(
    async ({ shape, runs }) => {
      // Built in the page so the fixtures never touch disk: SheetJS is already
      // loaded by the demo, and a docx is a handful of XML files in a zip.
      const buildXlsx = (rowCount) => {
        const data = [['Date', 'Customer', 'Amount', 'Status']];
        for (let i = 0; i < rowCount; i += 1) {
          data.push([`2026-01-${(i % 28) + 1}`, `Customer ${i}`, (i * 7.5).toFixed(2), i % 2 ? 'paid' : 'open']);
        }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Sheet1');
        return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })).buffer;
      };

      const buildDocx = async (paragraphs) => {
        const body = Array.from(
          { length: paragraphs },
          (_, i) => `<w:p><w:r><w:t xml:space="preserve">Paragraph ${i} of a benchmark document.</w:t></w:r></w:p>`,
        ).join('');
        const files = {
          '[Content_Types].xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
          '_rels/.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
          'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
        };
        // Stored (uncompressed) zip: enough for the engine, and it keeps this
        // script free of a zip dependency.
        const encoder = new TextEncoder();
        const parts = [];
        const central = [];
        let offset = 0;
        const crcTable = (() => {
          const table = new Uint32Array(256);
          for (let i = 0; i < 256; i += 1) {
            let c = i;
            for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            table[i] = c >>> 0;
          }
          return table;
        })();
        const crc32 = (bytes) => {
          let c = 0xffffffff;
          for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
          return (c ^ 0xffffffff) >>> 0;
        };
        for (const [name, text] of Object.entries(files)) {
          const nameBytes = encoder.encode(name);
          const data = encoder.encode(text);
          const crc = crc32(data);
          const local = new DataView(new ArrayBuffer(30));
          local.setUint32(0, 0x04034b50, true);
          local.setUint16(4, 20, true);
          local.setUint16(8, 0, true);
          local.setUint32(14, crc, true);
          local.setUint32(18, data.length, true);
          local.setUint32(22, data.length, true);
          local.setUint16(26, nameBytes.length, true);
          parts.push(new Uint8Array(local.buffer), nameBytes, data);
          const dir = new DataView(new ArrayBuffer(46));
          dir.setUint32(0, 0x02014b50, true);
          dir.setUint16(4, 20, true);
          dir.setUint16(6, 20, true);
          dir.setUint32(16, crc, true);
          dir.setUint32(20, data.length, true);
          dir.setUint32(24, data.length, true);
          dir.setUint16(28, nameBytes.length, true);
          dir.setUint32(42, offset, true);
          central.push(new Uint8Array(dir.buffer), nameBytes);
          offset += 30 + nameBytes.length + data.length;
        }
        const centralSize = central.reduce((n, part) => n + part.length, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, Object.keys(files).length, true);
        end.setUint16(10, Object.keys(files).length, true);
        end.setUint32(12, centralSize, true);
        end.setUint32(16, offset, true);
        const blob = new Blob([...parts, ...central, new Uint8Array(end.buffer)]);
        return await blob.arrayBuffer();
      };

      const buffer = shape.kind === 'xlsx' ? buildXlsx(shape.rows) : await buildDocx(shape.paragraphs);
      const fileName = shape.kind === 'xlsx' ? 'bench.xlsx' : 'bench.docx';

      const openedAt = performance.now();
      await post('document:open-buffer', { fileName, buffer, readonly: false });
      const openMs = Math.round(performance.now() - openedAt);

      const timings = [];
      let bytes = 0;
      for (let i = 0; i < runs; i += 1) {
        const started = performance.now();
        const saved = await post('document:save', {});
        timings.push(Math.round(performance.now() - started));
        bytes = saved.file.size;
      }
      return { openMs, timings, bytes, inputBytes: buffer.byteLength };
    },
    { shape, runs: RUNS },
  );

  rows.push({ shape: shape.name, ...result });
  await context.close();
}

await browser.close();

const cols = [
  ['document', 24],
  ['open (ms)', 11],
  ['first export', 14],
  ['warm export', 13],
  ['snapshot', 10],
];
console.log(cols.map(([n, w]) => n.padEnd(w)).join(''));
console.log('-'.repeat(cols.reduce((n, [, w]) => n + w, 0)));
for (const row of rows) {
  const [first, ...warm] = row.timings;
  const cells = [
    row.shape,
    row.openMs,
    `${first} ms`,
    warm.length ? `${median(warm)} ms` : '-',
    `${Math.round(row.bytes / 1024)} KB`,
  ];
  console.log(cells.map((c, i) => String(c).padEnd(cols[i][1])).join(''));
}
// The interval the scheduler would choose for each shape, so the table can be
// read as a decision rather than as raw numbers.
const MIN_MS = 30_000;
const MAX_MS = 180_000;
const DUTY = 300;
const interval = (ms) => Math.min(MAX_MS, Math.max(MIN_MS, ms * DUTY));

console.log(`\nCPU throttle: ${CPU_THROTTLE}x`);
console.log('Warm export is what one autosave snapshot costs. The scheduler turns it into');
console.log('an interval with clamp(export x 300, 30s, 180s) -- see lib/history/autosave.ts:');
for (const row of rows) {
  const [, ...warm] = row.timings;
  if (!warm.length) continue;
  const ms = median(warm);
  console.log(
    `  ${row.shape.padEnd(24)} ${String(ms + ' ms').padEnd(9)} -> snapshot every ${Math.round(interval(ms) / 1000)}s`,
  );
}
