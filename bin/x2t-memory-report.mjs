#!/usr/bin/env node
/**
 * Report what x2t's wasm binary demands of the browser, and how much of that
 * is negotiable. Read-only.
 *
 * Run this after a vendor bump. It answers the question that cost a day:
 * "opening a document needs 283 MB of contiguous wasm memory up front -- can
 * we ask for less?" The answer for the 9.4 build is no, and the numbers below
 * are why: the module's static/BSS layout reaches ~267 MB, so a smaller
 * `initial` puts compile-time pointers outside the memory and the module
 * aborts with `RuntimeError: memory access out of bounds` before it has read
 * anything. Measured, reverted, and written up in
 * docs/explorations/2026-08-20-x2t-wasm-oom-misclassified.md.
 *
 * The floor is invisible in the data section (11 MB) because most of the
 * static footprint is BSS: address space that costs nothing in the file. What
 * gives it away is the immutable i32 globals -- addresses the compiler baked
 * into the code.
 *
 * `maximum` is a separate matter and also not negotiable downwards: it is a
 * hard ceiling (_emscripten_resize_heap returns false above it) so lowering it
 * removes the ability to open large documents, and the glue's getHeapMax() is
 * hardcoded to 2 GB regardless.
 *
 * Usage: node bin/x2t-memory-report.mjs
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WASM_GZ = resolve(ROOT, 'public/sdkjs/common/wasm/x2t/x2t.wasm.gz');
const PAGE_BYTES = 65536;
const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);

const wasm = gunzipSync(readFileSync(WASM_GZ));
let offset = 8; // magic + version

const uleb = () => {
  let result = 0;
  let shift = 0;
  let byte;
  do {
    byte = wasm[offset++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return result;
};
const sleb = () => {
  let result = 0;
  let shift = 0;
  let byte;
  do {
    byte = wasm[offset++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  if (shift < 32 && byte & 0x40) result |= -(1 << shift);
  return result;
};

/**
 * Every section this script decodes has to land exactly on its own end.
 *
 * The loops below understand one initialiser shape (`i32.const <sleb> end`).
 * Anything else -- an i64 constant, a `global.get`, an extended const
 * expression -- leaves its operand bytes unread, and from that point on the
 * section is decoded from arbitrary bytes. `offset = end` at the bottom of the
 * outer loop then papers over it, so the script would print a plausible number
 * instead of failing: a floor that is too low recommends lowering `initial`,
 * which the header above documents as fatal. That is the one wrong answer this
 * script must never give, so it says so out loud instead.
 */
const expectExhausted = (id, end) => {
  if (offset !== end) {
    throw new Error(
      `section ${id}: decoder stopped at byte ${offset}, section ends at ${end}. ` +
        'An initialiser this script does not consume desynchronised the cursor, so ' +
        'every number below it came from arbitrary bytes -- including the static ' +
        'floor that decides whether `initial` can be lowered. Teach the decoder the ' +
        'new shape rather than trusting the output.',
    );
  }
};

let memory = null;
let dataEnd = 0;
let dataSegments = 0;
let staticFloor = 0;
let immutableI32 = 0;

while (offset < wasm.length) {
  const id = wasm[offset++];
  const size = uleb();
  const end = offset + size;

  if (id === 5) {
    // Memory section: what the browser is asked for.
    const count = uleb();
    const flags = uleb();
    const initial = uleb();
    memory = { initial, maximum: flags & 1 ? uleb() : null, shared: Boolean(flags & 2) };
    // Only the first memory is read, so the cursor is expected to be spent
    // only when there is exactly one -- which every emscripten build has.
    if (count === 1) expectExhausted(id, end);
  } else if (id === 6) {
    // Globals: immutable i32 initialisers are addresses the compiler baked in,
    // which is the only visible trace of the BSS high-water mark.
    const count = uleb();
    for (let i = 0; i < count; i++) {
      offset++; // value type
      const mutable = wasm[offset++];
      const op = wasm[offset++];
      if (op !== 0x41) {
        throw new Error(
          `global ${i}: initialiser opcode 0x${op.toString(16)} is not i32.const, whose ` +
            'operand length this script does not know. See expectExhausted above.',
        );
      }
      const value = sleb();
      if (!mutable && value > staticFloor) staticFloor = value;
      if (!mutable) immutableI32++;
      offset++; // end opcode
    }
    expectExhausted(id, end);
  } else if (id === 11) {
    // Data segments: the part of the static footprint that costs file bytes.
    const count = uleb();
    for (let i = 0; i < count; i++) {
      const flags = uleb();
      if (flags === 2) uleb(); // memory index
      let at = 0;
      if (flags === 0 || flags === 2) {
        offset++; // i32.const
        at = sleb();
        offset++; // end
      }
      const length = uleb();
      offset += length;
      dataSegments++;
      if (at + length > dataEnd) dataEnd = at + length;
    }
    expectExhausted(id, end);
  }
  offset = end;
}

if (!memory) throw new Error('no memory section');

const floorPages = Math.ceil(staticFloor / PAGE_BYTES);
console.log(`x2t.wasm  (${mb(wasm.length)} MB uncompressed)`);
console.log('');
console.log('asked of the browser:');
console.log(
  `  initial  ${memory.initial} pages = ${mb(memory.initial * PAGE_BYTES)} MB   committed up front, per editor frame`,
);
console.log(
  `  maximum  ${memory.maximum} pages = ${mb(memory.maximum * PAGE_BYTES)} MB   hard ceiling; growth above it fails`,
);
console.log('');
console.log('static footprint (the floor under `initial`):');
console.log(`  data segments        ${dataSegments}, highest end ${mb(dataEnd)} MB`);
console.log(`  immutable i32 globals ${immutableI32}, highest address ${mb(staticFloor)} MB  <- includes BSS`);
console.log('');
console.log(`floor: initial cannot go below ~${floorPages} pages (${mb(staticFloor)} MB).`);
const slack = memory.initial - floorPages;
console.log(
  `slack: ${slack} pages (${mb(slack * PAGE_BYTES)} MB) between the floor and what the build declares -- ` +
    (slack < 512
      ? 'nothing worth reclaiming. Lowering `initial` needs a different x2t build.'
      : 'possibly worth revisiting, but verify with the full E2E suite and the corpus.'),
);
