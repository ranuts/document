"""Validate run provenance/mechanics; semantic review remains separate."""
import hashlib
import json
import subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[2]
folder = root / 'docs/evaluations'
r = json.loads((folder / '2026-10-05-conditional-cpu-im-summary.json').read_text())
assert r['status'] == 'completed', r.get('error')
assert r['probeSHA256'] == hashlib.sha256((folder / 'probe-conditional-cpu-im-summary.mjs').read_bytes()).hexdigest()
assert r['cases'] == json.loads((folder / '2026-10-05-conditional-summary-cases.json').read_text())
frozen = subprocess.check_output(['git', 'show', '1a53222:docs/evaluations/2026-10-05-conditional-summary-cases.json'], cwd=root)
assert json.loads(frozen) == r['cases']
frozen_driver = subprocess.check_output(['git', 'show', '1a53222:docs/evaluations/probe-conditional-cpu-im-summary.mjs'], cwd=root)
assert hashlib.sha256(frozen_driver).hexdigest() == r['probeSHA256']
identity = json.loads((folder / '2026-10-05-conditional-cpu-model-identity.json').read_text())
assert identity['sha256'] == '626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d'
assert identity['bytes'] == 2104932768
assert r['bundleBytesUnchanged'] is True
assert not r['errors'], r['errors']
assert len(r['results']) == 3
for row, case in zip(r['results'], r['cases']):
    assert row['id'] == case['id']
    assert row['selected'].rstrip('\r\n') == case['source']
    assert row['previewCount'] == 0
    assert row['isolated'] is True
    assert len(row['raw']) == len(row['inputs']) == 1
    assert row['inputs'][0]['request']['temperature'] == 0
    if not row['documentUnchanged']:
        assert row['undoExact'] and row['redoExact']
    else:
        assert row['output'] == row['selected']
print('Three frozen cases completed actual native inference; application/history mechanics verified, no quality acceptance inferred')
