import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-sort-negation-variants.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
a,b,c=r['cases']
for x in [a,b,c]:
    assert x['after']==r['before'] and x['previews']==0
    assert x['actions'][0]=='count_chat' and 'completion' in x['actions']
assert len(a['errors'])==1 and 'No executable operation' in a['errors'][0]
assert len(b['errors'])==1 and 'could not be completed' in b['errors'][0]
assert not c['errors'] and 'B2\n30' in c['messages']
print('Variant diagnostic confirmed: unchanged snapshots, valid read preserved, English generic-error gap remains')
