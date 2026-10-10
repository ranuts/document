import hashlib
import json
from pathlib import Path

p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-native-count-boundary.json').read_text())
assert r['status'] == 'completed' and r['phase'] == 'verified' and not r['errors']
assert r['probeSHA256'] == hashlib.sha256((p / 'probe-cpu-native-count-boundary.mjs').read_bytes()).hexdigest()
xs = r['result']['samples']
assert [x['target'] for x in xs] == [239, 240, 255, 256]
for x in xs:
    assert x['measured']['success'] and x['measured']['context_tokens'] == 256
    assert x['measured']['prompt_tokens'] == x['target'] and x['request']['max_tokens'] == 16
    assert x['fits'] == (x['target'] + 16 + 1 <= 256)
for x, outputs in zip(xs[:3], [16, 16, 1]):
    assert x['reply']['usage']['prompt_tokens'] == x['target']
    assert x['reply']['usage']['completion_tokens'] == outputs and 'error' not in x
assert 'request (256 tokens) exceeds the available context size (256 tokens)' in xs[3]['error']
assert r['result']['recovery']['prompt_tokens'] == 16
assert r['result']['reply']['choices'][0]['finish_reason'] == 'stop'
print('Exact 256-context boundary: outputs 16/16/1 at prompts 239/240/255; prompt 256 refused; subsequent recovery passed')
