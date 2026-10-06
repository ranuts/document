import json
from pathlib import Path
p=Path(__file__).parent
seed=json.loads((p/'2026-10-04-cpu-count-im-sequence-read-failure.json').read_text())
assert seed['seedTextLength']==32767 and not seed['cases'][0]['errors']
r=json.loads((p/'2026-10-04-cpu-count-im-sequence-read-failure-aggregate.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
assert r['seedTextLength']==98301
x=r['cases'][0]
assert x['after']==r['before'] and x['actions']==[] and x['previews']==0
assert len(x['errors'])==1 and 'could not be completed' in x['errors'][0]
assert not x['activity'] and 'Result checked' not in x['messages']
print('Actual aggregate read failure prevents the subsequent write; generic error feedback remains a gap')
