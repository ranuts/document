import json
from pathlib import Path

p = Path(__file__).parent
a = json.loads((p / '2026-10-04-cpu-shipped-compat-baseline.json').read_text())
b = json.loads((p / '2026-10-04-cpu-native-build-4020.json').read_text())
for r in [a, b]:
    assert r['status'] == 'completed' and r['phase'] == 'generated' and not r['errors']
    assert any(x['url'] == '/model.gguf' and x['responseBytes'] == 484220320 for x in r['served'])
    assert r['result']['reply']['choices'][0]['finish_reason'] == 'stop'
assert a['result']['reply']['choices'] == b['result']['reply']['choices']
assert a['result']['reply']['usage'] == b['result']['reply']['usage']
assert a['files'] != b['files']
print('Pinned self-built compatibility baseline loads/generates; exact reply and usage match shipped control for one request')
