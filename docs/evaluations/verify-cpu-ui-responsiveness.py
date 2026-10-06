"""Verify a single observed CPU responsiveness run; no universal timing threshold."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
folder=root/'docs/evaluations'
r=json.loads((folder/'2026-10-05-cpu-ui-responsiveness.json').read_text())
assert r['passed'] and r['contextClosed'],r.get('error')
assert r['probeSHA256']==hashlib.sha256((folder/'probe-cpu-ui-responsiveness.mjs').read_bytes()).hexdigest()
assert 'CPU' in r['engine'] and len(r['partialText'])>=40
assert not r['errors'] and not r['guidance'] and r['previewCount']==0
assert r['documentBefore']==r['documentAfter']
p=r['measurement']
assert p['stopAt']>p['inferenceStart']
assert p['unlockedAt']>=p['stopAt']
for group in ('frames','timers'):
    for phase in ('idle','inference','recovery'):
        assert len(p[group][phase])>=2
        assert all(value>=0 for value in p[group][phase])
print('Actual CPU stream, passive frame/timer samples, Stop/input recovery and unchanged document verified; no benchmark threshold inferred')
