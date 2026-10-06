"""Verify native browser restore/download evidence; not universal storage durability."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
p=root/'docs/evaluations'
r=json.loads((p/'2026-10-04-history-deletion-focus-browser.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['downloadError'] is None
assert r['probeSHA256']==hashlib.sha256((p/'probe-history-deletion-focus-browser.mjs').read_bytes()).hexdigest()
for f,h in r['sourceHashes'].items(): assert hashlib.sha256((root/f).read_bytes()).hexdigest()==h
assert r['initial']=={'saving':False,'history':[]}
assert r['beforeReload']['messages']==r['restored']['messages']==r['messages']
assert r['beforeReload']['id']==r['restored']['id'] and r['restored']['saving'] is True
assert r['downloadName'].startswith('conversations-') and r['downloadName'].endswith('.json')
e=r['export']
assert set(e)=={'version','activeId','sessions','exportedAt'} and e['version']==1
assert e['activeId']==r['restored']['id'] and len(e['sessions'])==1
assert e['sessions'][0]['id']==e['activeId'] and e['sessions'][0]['messages']==r['messages']
assert set(e['sessions'][0])=={'id','title','createdAt','updatedAt','messages'}
assert r['focusResults']==[{'selector':v,'active':v[1:],'hidden':True} for v in ['.agent-history-delete-current','.agent-history-delete-all']]
print('Native Chromium IndexedDB opt-in, reload restoration and downloaded JSON fidelity verified')
