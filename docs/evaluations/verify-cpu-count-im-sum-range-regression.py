import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-sum-history-range-regression.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
a,b=r['cases']
for x in [a,b]:
    assert x['actions'][0]=='count_chat' and 'completion' in x['actions']
    assert not x['errors'] and x['previews']==0
assert a['after']==r['before'] and 'A1:A3: 25' in a['messages']
assert b['after'][:3]==r['before'][:3]
assert b['after'][3]=={'value':'25','formula':'SUM(A1:A3)'}
assert 'Result checked' in b['messages']
assert r['undo']==r['before'] and r['redo']==b['after']
print('CPU Chinese IM read-only sum, verified SUM formula write and native history passed')
