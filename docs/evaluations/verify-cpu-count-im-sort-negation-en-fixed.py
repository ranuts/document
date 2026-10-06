import json
from pathlib import Path
p=Path(__file__).parent
trace=json.loads((p/'2026-10-04-cpu-count-im-sort-negation-caller.json').read_text())
values=[v.get('value',{}).get('value') for e in trace['exceptions'] for group in e['locals'] for v in group]
assert '{"tool":"sort_range","input":{"range":"C1","column":"A","descending":false,"header":true}}' in values
r=json.loads((p/'2026-10-04-cpu-count-im-sort-negation-en-fixed.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
a,b,c=r['cases']
assert all(x['after']==r['before'] and x['previews']==0 for x in [a,b,c])
assert b['actions']==[] and len(b['errors'])==1 and 'No executable operation' in b['errors'][0]
assert not c['errors'] and 'B2\n30' in c['messages']
assert c['actions'][0]=='count_chat' and 'completion' in c['actions']
print('Invalid English no-op plan traced; bounded fix blocks inference and preserves valid read')
