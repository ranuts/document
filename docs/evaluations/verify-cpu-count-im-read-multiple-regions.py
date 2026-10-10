import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-read-multiple-regions.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
a,b,c=r['cases']
for x in [a,b]:
    assert x['after']==r['before'] and not x['errors'] and x['previews']==0
    assert 'A2: "Cora"' in x['messages'] and 'A3: "Davi"' not in x['messages']
assert not c['errors'] and c['previews']==0 and 'Result checked' in c['messages']
assert c['after'][0][0]=='99' and c['after'][1][1]=='30'
assert 'A1: "Name"' not in c['messages']
print('Partial coverage failures confirmed: second range omitted; read-then-write writes the wrong cell A1')
