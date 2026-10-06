"""Verify controlled native-exit-delay UI evidence, not physical fault certification."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
folder=root/'docs/evaluations'
r=json.loads((folder/'2026-10-05-runtime-handover-ui.json').read_text())
assert r['passed'],r.get('error')
assert r['probeSHA256']==hashlib.sha256((folder/'probe-runtime-handover-ui.mjs').read_bytes()).hexdigest()
assert r['contextClosed'] and r['bundleBytesUnchanged']
assert not r['errors']
assert 'CPU' in r['engine']
w=r['waiting']
assert w['progressVisible'] and w['stopVisible'] and w['loadDisabled']
assert '正在准备 AI' in w['status']
assert w['exits']==1 and w['exitFinished']==0 and w['loads']==0
assert r['stopped']['note']=='已停止。'
assert r['stopped']['progressHidden'] and not r['stopped']['loadDisabled']
assert r['afterExit']['exitFinished']==1 and r['afterExit']['loads']==0
assert r['afterExit']['note']=='已停止。'
assert r['recovered']['loads']==1 and r['recovered']['answers']==1
assert not r['recovered']['guidance'] and r['recovered']['previewCount']==0
assert r['documentBefore']==r['documentAfter']
print('Controlled native exit wait, Stop, actual teardown/reload/chat and unchanged document verified')

before=json.loads((folder/'2026-10-05-runtime-handover-ui-before.json').read_text())
assert before['passed'] is False and before['contextClosed']
assert before['probeSHA256']==hashlib.sha256((folder/'probe-runtime-handover-ui-before.mjs').read_bytes()).hexdigest()
assert 'not visible' in before['error']
print('Initial hidden-control probe failure retained with matching executed-driver hash')
