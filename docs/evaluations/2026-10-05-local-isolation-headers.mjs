import assert from 'node:assert/strict';
const origin = process.argv[2] || 'http://127.0.0.1:5195';
const url = `${origin}/sdkjs/common/spell/spell/spell.js`;
const initial = await fetch(url, { method: 'HEAD' });
assert.equal(initial.status, 200);
const etag = initial.headers.get('etag');
assert.ok(etag);
const conditional = await fetch(url, { method: 'HEAD', headers: { 'If-None-Match': etag } });
assert.equal(conditional.status, 304);
for (const response of [initial, conditional]) {
  assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
}
console.log(JSON.stringify({ origin, statuses: [initial.status, conditional.status], isolationHeadersRetained: true }));
