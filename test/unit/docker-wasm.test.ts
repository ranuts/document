import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const WASM_PATH = 'sdkjs/common/wasm/x2t/x2t.wasm.br';

it('packages the real vendor WASM as gzip without changing the decoded module or source', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'document-docker-wasm-'));
  try {
    const source = readFileSync(resolve(ROOT, 'public', WASM_PATH));
    const target = resolve(root, WASM_PATH);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
    const result = spawnSync(process.execPath, [resolve(ROOT, 'bin/prepare-docker-wasm.mjs'), root], {
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    const packed = readFileSync(target);
    expect([...packed.subarray(0, 2)]).toEqual([0x1f, 0x8b]);
    expect(gunzipSync(packed).equals(brotliDecompressSync(source))).toBe(true);
    expect(readFileSync(resolve(ROOT, 'public', WASM_PATH)).equals(source)).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  // Re-compressing the real 42 MB module needs more than Vitest's default
  // five-second budget on a shared CI runner.
}, 60_000);
