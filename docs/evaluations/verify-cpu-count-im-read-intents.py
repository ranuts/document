import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-read-intents.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
a,b,c=r['cases']
for x in [a,b,c]:
    assert x['after']==r['before'] and not x['errors'] and x['previews']==0
    assert x['actions'][0]=='count_chat' and 'completion' in x['actions']
assert 'B2\n30' in a['messages'] and 'B2\n30' in b['messages']
assert 'A1\nName' in c['messages'] and 'Davi' not in c['messages'] and 'Mira' not in c['messages']
print('Single-cell reads correct; range request silently returns only A1 and remains a semantic failure')
