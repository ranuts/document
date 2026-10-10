import hashlib, json
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/'2026-10-04-history-deletion-failure-retry-browser.json').read_text())
assert r['status']=='completed' and not r['errors']
assert r['probeSHA256']==hashlib.sha256((root/'probe-history-deletion-failure-retry-browser.mjs').read_bytes()).hexdigest()
for f,h in r['sourceHashes'].items():
 assert hashlib.sha256((root.parent.parent/f).read_bytes()).hexdigest()==h
assert r['failedDeletion']['active']=='agent-history-confirm'
assert not r['failedDeletion']['hidden']
assert r['failedDeletion']['messages']==[{'role':'user','content':'preserve on failure'}]
assert r['retriedDeletion']=={'active':'agent-history-delete-all','hidden':True,'messages':[]}
for x in r['focusResults']: assert '.'+x['active']==x['selector'] and x['hidden']
assert r['restored']['saving'] and r['restored']['id']==r['beforeReload']['id']
assert r['restored']['messages']==r['messages']==r['beforeReload']['messages']
assert r['downloadError'] is None and r['export']['sessions'][0]['messages']==r['messages']
print('Chromium deletion failure preserves history and retry focus; Enter retry and success focus verified')
