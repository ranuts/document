"""Verify size/cache/quiet-period observations; no product acceptance claim."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent
report = json.loads((root / '2026-10-03-sw-cache-lifetime-controls.json').read_text())
assert report['probeSha256'] == hashlib.sha256((root / 'probe-sw-cache-lifetime-controls.mjs').read_bytes()).hexdigest()
asset = (root.parents[1] / 'public/sdkjs/common/wasm/x2t/x2t.wasm.br').read_bytes()
large = json.loads(subprocess.run([
    'node', '-e', "const f=require('node:fs'),z=require('node:zlib'),c=require('node:crypto');"
    "const b=z.brotliDecompressSync(f.readFileSync(0));"
    "process.stdout.write(JSON.stringify({bytes:b.length,hash:c.createHash('sha256').update(b).digest('hex')}));"
], input=asset, capture_output=True, check=True, timeout=30).stdout)
specs = [('large-cached', False, True, 0), ('tiny-cached', True, True, 0),
         ('large-network', False, False, 0), ('large-cached-quiet', False, True, 40000)]
assert len(report['rows']) == len(specs)
for row, (name, tiny, cache, quiet) in zip(report['rows'], specs):
    assert (row['name'], row['tiny'], row['cache'], row['quietMs']) == (name, tiny, cache, quiet)
    expected_bytes = 8 if tiny else large['bytes']
    expected_hash = hashlib.sha256(bytes([0, 97, 115, 109, 1, 0, 0, 0])).hexdigest() if tiny else large['hash']
    assert row['decodedBytes'] == row['firstBytes'] == row['secondBytes'] == expected_bytes
    assert row['sha256'] == expected_hash
    assert row['secondNetworkRequests'] == (0 if cache else 1)
    assert row['updateStarted'] - row['consumptionFinished'] >= quiet
    assert row['delivery'] == {'received': True}
    observations = row['observations']
    assert any(v['target'] == 'waiting' and v['value'] == {'version': 'new'} for v in observations)
    active = [v for v in observations if v['target'] == 'active']
    assert active[0]['value'] == {'version': 'old'}
    if row['passed']:
        assert row['final'] == {'version': 'new'} and active[-1]['value'] == {'version': 'new'}
    else:
        assert row['error'] == 'Error: Version timeout: active new'
        assert all(v['value'] == {'version': 'old'} for v in active)
        assert active[-1]['time'] - active[1]['time'] >= 19000
assert report['passed'] == all(row['passed'] for row in report['rows'])
print(json.dumps({'verified': [{k: row[k] for k in ['name', 'quietMs', 'passed']} for row in report['rows']],
                  'productMigrationAccepted': False}))
