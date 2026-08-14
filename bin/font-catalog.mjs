#!/usr/bin/env node
/**
 * Convert between raw TTF/OTF files and the OnlyOffice indexed-catalog wire
 * format used by public/fonts/{index}: the first 32 bytes are XOR-obfuscated
 * with a fixed 16-byte key, the rest of the file is untouched. The transform
 * is symmetric (encode and decode are the same operation).
 *
 * Usage:
 *   node bin/font-catalog.mjs encode <font.ttf> <public/fonts/NNN>
 *   node bin/font-catalog.mjs decode <public/fonts/NNN> <font.ttf>
 *   node bin/font-catalog.mjs verify <public/fonts/NNN>
 *
 * After encoding, register the file in public/sdkjs/common/AllFonts.js:
 * append its name to __fonts_files and add one row per font-name alias to
 * __fonts_infos pointing at that file position. See docs/fonts.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const XOR_KEY = [160, 102, 214, 32, 20, 150, 71, 250, 149, 105, 184, 80, 176, 65, 73, 72];
const OBFUSCATED_PREFIX_LENGTH = 32;

// sfnt magics: TrueType (00 01 00 00), OpenType/CFF ("OTTO"), legacy Mac ("true")
const VALID_MAGICS = ['00010000', '4f54544f', '74727565'];

function transform(buffer) {
  const out = Buffer.from(buffer);
  const n = Math.min(OBFUSCATED_PREFIX_LENGTH, out.length);
  for (let i = 0; i < n; i++) {
    out[i] ^= XOR_KEY[i % XOR_KEY.length];
  }
  return out;
}

function magicOf(buffer) {
  return buffer.subarray(0, 4).toString('hex');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [command, input, output] = process.argv.slice(2);

if (!command || !input || (command !== 'verify' && !output)) {
  fail('Usage: font-catalog.mjs <encode|decode|verify> <input> [output]');
}

const bytes = readFileSync(input);

switch (command) {
  case 'encode': {
    if (!VALID_MAGICS.includes(magicOf(bytes))) {
      fail(`${input} does not look like a TTF/OTF (magic ${magicOf(bytes)})`);
    }
    writeFileSync(output, transform(bytes));
    console.log(`Encoded ${input} -> ${output} (${bytes.length} bytes)`);
    break;
  }
  case 'decode': {
    const decoded = transform(bytes);
    if (!VALID_MAGICS.includes(magicOf(decoded))) {
      fail(`${input} did not decode to a valid TTF/OTF (magic ${magicOf(decoded)})`);
    }
    writeFileSync(output, decoded);
    console.log(`Decoded ${input} -> ${output} (${bytes.length} bytes)`);
    break;
  }
  case 'verify': {
    const decoded = transform(bytes);
    if (VALID_MAGICS.includes(magicOf(decoded))) {
      console.log(`${input}: valid catalog font (decodes to magic ${magicOf(decoded)})`);
    } else if (VALID_MAGICS.includes(magicOf(bytes))) {
      fail(`${input}: already a plain TTF/OTF, not catalog-encoded`);
    } else {
      fail(`${input}: not a catalog font (decoded magic ${magicOf(decoded)})`);
    }
    break;
  }
  default:
    fail(`Unknown command: ${command}`);
}
