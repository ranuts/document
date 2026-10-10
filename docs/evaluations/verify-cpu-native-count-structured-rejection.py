import hashlib
import json
from pathlib import Path

p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-native-count-structured-rejection.json').read_text())
assert r['status'] == 'completed' and r['phase'] == 'verified' and not r['errors']
assert r['routeHits']
for key, name in [('probeSHA256', 'probe-cpu-native-count-structured-rejection.mjs'), ('patchSHA256', 'cpu-native-count-structured-rejection.patch')]:
    assert r[key] == hashlib.sha256((p / name).read_bytes()).hexdigest()
z = r['result']
assert [x['id'] for x in z['results']] == ['ascii', 'chinese', 'mixed', 'multi-turn']
for x in z['results']:
    assert x['first'] == x['second'] and x['first']['success'] and x['first']['error'] == ''
    assert x['first']['context_tokens'] == 2048
    assert x['first']['prompt_tokens'] == x['reply']['usage']['prompt_tokens']
    assert x['countActions'] == ['count_chat', 'count_chat']
assert z['oversized']['success'] and z['oversized']['prompt_tokens'] > z['oversized']['context_tokens']
assert 'does not support content parts' in z['unsupportedError']
assert z['recovery']['success'] and z['recovery']['prompt_tokens'] == 16
assert z['reply']['choices'][0]['message']['content'] == z['results'][0]['reply']['choices'][0]['message']['content']
counts = r['partial']['counts']
assert len(counts) == 11 and len(r['partial']['results']) == 4
assert counts[-2]['response']['success'] is False
assert counts[-2]['response']['prompt_tokens'] == counts[-2]['response']['context_tokens'] == 0
assert counts[-1]['response']['success'] is True
print('Four exact prompt-usage comparisons, repeated count-only actions, detected overflow, structured rejection and subsequent model recovery')
