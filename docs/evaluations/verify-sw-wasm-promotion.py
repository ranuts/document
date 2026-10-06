"""Check controlled WASM observations without turning diagnostic passes into product acceptance."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
probe_hash = hashlib.sha256((root / 'probe-sw-wasm-promotion.mjs').read_bytes()).hexdigest()
asset = (root.parents[1] / 'public/sdkjs/common/wasm/x2t/x2t.wasm.br').read_bytes()
metadata = json.loads(subprocess.run([
    'node', '-e', "const fs=require('node:fs'),z=require('node:zlib'),c=require('node:crypto');"
    "const b=z.brotliDecompressSync(fs.readFileSync(0));"
    "process.stdout.write(JSON.stringify({bytes:b.length,sha256:c.createHash('sha256').update(b).digest('hex')}));"
], input=asset, capture_output=True, check=True, timeout=30).stdout)
outcomes = []
for filename, reconstruct in [
    ('2026-10-03-sw-wasm-direct-response.json', False),
    ('2026-10-03-sw-wasm-reconstructed-response.json', True),
]:
    report = json.loads((root / filename).read_text())
    assert report['probeSha256'] == probe_hash
    assert report['reconstruct'] is reconstruct
    assert report['wasm'] == {
        'compressedBytes': len(asset), 'decodedBytes': metadata['bytes'],
        'sha256': metadata['sha256']}
    assert report['modes'] == ['drain', 'compile-main', 'compile-worker']
    assert len(report['rows']) == 3
    for row, mode in zip(report['rows'], report['modes']):
        assert row['mode'] == mode
        assert row['warm']['bytes'] == metadata['bytes']
        assert row['cachedNetworkRequests'] == 0
        assert row['delivery'] == {'received': True}
        if mode == 'drain':
            assert row['cached']['bytes'] == metadata['bytes']
        else:
            assert row['cached']['exports'] > 0 and row['cached']['imports'] > 0
        versions = row['observations']
        assert any(v['target'] == 'waiting' and v['value'] == {'version': 'new'} for v in versions)
        active = [v for v in versions if v['target'] == 'active']
        assert active[0]['value'] == {'version': 'old'}
        if row['passed']:
            assert row['final'] == {'version': 'new'}
            assert active[-1]['value'] == {'version': 'new'}
        else:
            assert row['error'] == 'Error: Version timeout: active new'
            assert all(v['value'] == {'version': 'old'} for v in active)
            assert active[-1]['time'] - active[1]['time'] >= 19000
        outcomes.append({'reconstruct': reconstruct, 'mode': mode, 'promotedWithinBound': row['passed']})
    assert report['passed'] == all(row['passed'] for row in report['rows'])
assert any(not row['promotedWithinBound'] and row['mode'] == 'drain' for row in outcomes)
assert any(not row['promotedWithinBound'] and not row['reconstruct'] for row in outcomes)
print(json.dumps({'verified': outcomes, 'productMigrationAccepted': False}))
