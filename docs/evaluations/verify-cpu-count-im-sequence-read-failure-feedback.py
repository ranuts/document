import json
from pathlib import Path
r = json.loads((Path(__file__).parent / '2026-10-04-cpu-count-im-sequence-read-failure-feedback.json').read_text())
assert r['status'] == 'completed' and r['bundleUnchanged'] and not r['errors']
assert r['seedTextLength'] == 98301
x = r['cases'][0]
assert x['after'] == r['before'] and x['actions'] == [] and x['previews'] == 0
assert len(x['errors']) == 1 and 'Read a smaller range' in x['errors'][0]
assert 'could not be completed' not in x['errors'][0]
assert not x['activity'] and 'Result checked' not in x['messages']
print('Actual IM displays smaller-range guidance; failed read prevents subsequent write')
