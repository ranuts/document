import json
from pathlib import Path
p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-count-im-recovery.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and r['bundleUnchanged']
assert r['engine'].startswith('CPU')
for name in ['normal', 'recovery']:
    x = r[name]
    assert x['actions'][0] == 'count_chat' and 'completion' in x['actions']
    assert x['replies'] and not x['errors'] and x['previews'] == 0
x = r['overflow']
assert x['actions'] == ['count_chat'] and not x['replies'] and x['previews'] == 0
assert len(x['errors']) == 1 and 'custom system prompt' in x['errors'][0] and 'Restore request' in x['errors'][0]
build = json.loads((p / '2026-10-04-cpu-count-product-build.json').read_text())
asset = Path(build['wasmAssets']['native/default/wllama.wasm']['file']).name
assert any(asset in x['text'] and 'Loading' in x['text'] for x in r['console'])
assert any('Multithread enabled: true, pthreadPoolSize: 4' in x['text'] for x in r['console'])
print('Actual IM normal CPU loader counts before generation, rejects system overflow without generation, and recovers')
