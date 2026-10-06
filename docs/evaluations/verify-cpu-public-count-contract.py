import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-public-count-contract.json').read_text())
assert r['status'] == 'completed' and r['phase'] == 'verified' and not r['errors']
assert r['probeSHA256'] == hashlib.sha256((p / 'probe-cpu-public-count-contract.mjs').read_bytes()).hexdigest()
assert r['patchSHA256'] == hashlib.sha256((p / 'cpu-native-count-structured-rejection.patch').read_bytes()).hexdigest()
z = r['result']
assert z['preError'] == z['postError'] == 'AbortError'
assert z['preNativeActions'] == 0
assert z['baseline'] == z['recovered'] == {'promptTokens': 16, 'contextTokens': 2048}
assert [x['kwargs']['enable_thinking'] for x in z['variants']] == [True, False]
assert [x['count']['promptTokens'] for x in z['variants']] == [12, 16]
for x in z['variants']:
    assert x['count']['promptTokens'] == x['usage']['prompt_tokens']
    assert x['count']['contextTokens'] == 2048
assert z['actions'].count('count_chat') == 5
assert 'not mid-flight interruption' in z['postAbortScope']
print('Template counts match actual usage; pre-dispatch and post-response abort checks recover')
