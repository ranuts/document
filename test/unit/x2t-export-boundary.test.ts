import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

it('returns exported bytes to its immediate host without disclosing them to the top-level ancestor', () => {
  type Stream = { fileName: string; buffer: ArrayBuffer };
  const parentInbox: Stream[] = [];
  const topInbox: Stream[] = [];
  const top: any = { postMessage: (data: Stream) => topInbox.push(data) };
  top.parent = top;
  const parent = { parent: top, OO_FILE_STREAM_ONLY: true, postMessage: (data: Stream) => parentInbox.push(data) };
  const AscCommon: any = {};
  const frame = { parent, top, AscCommon };
  runInNewContext(readFileSync(resolve('public/sdkjs/common/wasm/x2t/x2t_helper.js'), 'utf8'), {
    window: frame,
    document: {},
    AscCommon,
    ArrayBuffer,
    Uint8Array,
  });
  AscCommon.x2t.downloadFile(new Uint8Array([7, 8, 9]), 'private.docx');
  expect(parentInbox).toHaveLength(1);
  expect(parentInbox[0].fileName).toBe('private.docx');
  expect(Array.from(new Uint8Array(parentInbox[0].buffer))).toEqual([7, 8, 9]);
  expect(topInbox).toHaveLength(0);
});
