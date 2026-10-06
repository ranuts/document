import hashlib
import json
from pathlib import Path

p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-native-count-retirement.json').read_text())
assert r['status'] == 'completed' and r['phase'] == 'verified' and not r['errors']
assert r['probeSHA256'] == hashlib.sha256((p / 'probe-cpu-native-count-retirement.mjs').read_bytes()).hexdigest()
z = r['result']
assert len(z['retirement']['settled']) == 2
for x in z['retirement']['settled']:
    assert x['status'] == 'rejected' and 'Wllama worker terminated' in x['error']
assert 'Wllama worker terminated' in z['retirement']['lateError']
assert z['replacementCount']['success'] and z['replacementCount']['prompt_tokens'] == 16
assert z['reply']['usage']['prompt_tokens'] == 16 and z['reply']['choices'][0]['finish_reason'] == 'stop'
assert z['actions'] == ['count_chat', 'count_chat', 'count_chat']
print('Two pending SDK count requests and late retired request rejected; fresh replacement counts and generates')
