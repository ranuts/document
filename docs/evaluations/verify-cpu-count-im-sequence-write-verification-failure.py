import json
from pathlib import Path
r = json.loads((Path(__file__).parent / '2026-10-04-cpu-count-im-sequence-write-verification-failure.json').read_text())
assert r['status'] == 'completed' and r['bundleUnchanged'] and not r['errors']
x = r['cases'][0]
assert x['request'] == '读取 A1:B4 的内容，然后将 B2 设置为 "00123"。'
assert r['before'][1][1] == '30'
expected = [row[:] for row in r['before']]
expected[1][1] = '123'
assert x['after'] == expected
assert len(x['errors']) == 1 and 'could not be verified' in x['errors'][0] and 'Undo' in x['errors'][0]
assert len(x['activity']) == 1 and 'B2: "30"' in x['activity'][0]
assert 'Result checked' not in x['messages']
assert x['actions'] == [] and x['previews'] == 0
print('Native numeric coercion is detected; completed read remains and no final success is reported')
