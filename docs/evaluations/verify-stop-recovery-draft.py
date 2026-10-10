"""Check actual CPU Stop/reload draft preservation with a controlled load gate."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
folder=root/'docs/evaluations'
r=json.loads((folder/'2026-10-05-stop-recovery-draft.json').read_text())
assert r['passed'] and r['contextClosed'],r.get('error')
assert r['probeSHA256']==hashlib.sha256((folder/'probe-stop-recovery-draft.mjs').read_bytes()).hexdigest()
assert 'CPU' in r['engine']
assert not r['errors'] and not r['guidance'] and r['previewCount']==0
assert r['documentBefore']==r['documentAfter']
for stage in ('waiting','ready'):
    x=r[stage]
    assert x['draft']=='为什么旧钟会走慢？'
    assert x['userMessages']==1 and x['loads']==1 and x['generations']==1
assert r['waiting']['sendDisabled'] and not r['ready']['sendDisabled']
assert r['sent']=={'draft':'','userMessages':2,'loads':1,'generations':2}
print('Draft retained through actual CPU Stop/reload, blocked early Enter, no auto-send and one explicit subsequent generation verified')
