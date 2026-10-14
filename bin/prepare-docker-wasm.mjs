import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync, gzipSync } from 'node:zlib';

// Docker supports ordinary http://<server-ip>, where Chrome will not decode
// Brotli. Re-encode only the image builder's copy; HTTPS Pages keeps Brotli.
// The loader URL stays stable and opaque: Content-Encoding describes the
// transport, not the .br suffix. sws.toml must declare gzip for this payload.
// Run before Vite copies public and build.sh fingerprints the vendor tree.
const root = process.argv[2];
if (!root) throw new Error('Usage: node bin/prepare-docker-wasm.mjs <public-directory>');
const path = resolve(root, 'sdkjs/common/wasm/x2t/x2t.wasm.br');
const wasm = brotliDecompressSync(readFileSync(path));
const magic = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
if (!wasm.subarray(0, 8).equals(magic)) throw new Error('x2t payload is not a WASM module');
const packed = gzipSync(wasm, { level: 9 });
writeFileSync(path, packed);
console.log(`[docker] Encoded x2t WASM as gzip (${packed.length} bytes)`);
