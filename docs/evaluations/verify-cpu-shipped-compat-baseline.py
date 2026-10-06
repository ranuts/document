import json
from pathlib import Path

p = Path(__file__).parent
a = json.loads((p / '2026-10-04-cpu-native-build-logs.json').read_text())
b = json.loads((p / '2026-10-04-cpu-shipped-compat-baseline.json').read_text())
assert a['status'] == 'failed' and a['phase'] == 'load'
assert '(ABORT)' in a['error']
assert b['status'] == 'completed' and b['phase'] == 'generated' and not b['errors']
assert a['files']['js'] != b['files']['js'] and a['files']['wasm'] != b['files']['wasm']
q = b['result']['reply']
assert q['choices'][0]['finish_reason'] == 'stop'
assert q['choices'][0]['message']['content'] == 'Hello! How can I assist you today?'
assert q['usage']['prompt_tokens'] == 16 and q['usage']['completion_tokens'] == 10
for r in [a, b]:
    assert any(x['url'] == '/model.gguf' and x['responseBytes'] == 484220320 for x in r['served'])
print('Self-built pair aborts in load; installed compatibility pair loads and generates under the same harness')
