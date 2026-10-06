import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-sort-negation-fixed.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
a,b,c=r['cases']
for x in [a,b,c]:
    assert x['after']==r['before'] and x['previews']==0
    if x is not a: assert x['actions'][0]=='count_chat' and 'completion' in x['actions']
assert a['actions']==[] and len(a['errors'])==1 and 'C1: 0' not in a['messages']
assert len(b['errors'])==1 and 'No executable operation' in b['errors'][0]
assert not c['errors'] and 'B2\n30' in c['messages']
print('No-op request cannot invent an operation; explicit read and conflict rejection preserved')
