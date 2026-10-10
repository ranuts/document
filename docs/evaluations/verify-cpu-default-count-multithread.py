import hashlib
import json
from pathlib import Path

p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-default-count-multithread.json').read_text())
assert r['status'] == 'completed' and r['phase'] == 'verified' and not r['errors']
assert any(x['url'] == '/sdk.js' for x in r['served'])
for key, name in [('probeSHA256', 'probe-cpu-default-count-multithread.mjs'), ('patchSHA256', 'cpu-native-count-structured-rejection.patch')]:
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
assert len(r['partial']['counts']) == 10
assert z['actions'].count('count_chat') == 11
print('Public client: four exact usage comparisons, repeated counts, overflow detection and rejection recovery verified')
capabilities = z['capabilities']
assert capabilities == {'crossOriginIsolated': True, 'hasJSPI': True, 'memory64Module': True}
selected = json.loads(next(x['text'] for x in r['console'] if x['text'].startswith('DIAGNOSTIC_RESOURCES ')).split(' ', 1)[1])
assert selected['compat'] is False and selected['hasInlineWorker'] is False
binding = json.loads((p / '2026-10-04-cpu-default-count-client-binding.json').read_text())
assert r['files']['js'] == binding['runtimeSHA256'] and r['files']['wasm'] == binding['wasmSHA256']
print('Actual default memory64/JSPI runtime selection and paired native artifacts verified')
assert any('Multithread enabled: true, pthreadPoolSize: 4' in x['text'] for x in r['console'])
