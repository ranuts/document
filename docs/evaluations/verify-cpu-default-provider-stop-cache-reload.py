import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-default-provider-stop-cache-reload.json').read_text())
assert r['status'] == 'completed' and r['phase'] == 'verified' and not r['errors']
assert r['probeSHA256'] == hashlib.sha256((p / 'probe-cpu-default-provider-stop-cache-reload.mjs').read_bytes()).hexdigest()
package = json.loads((p / '2026-10-04-cpu-count-dual-package.json').read_text())
assert r['clientSHA256'] == package['entries']['client/index.js']
assert r['files']['wasm'] == package['entries']['native/default/wllama.wasm']
z = r['result']
assert 'AbortError' in z['stopError']
assert z['afterStop']['ready'] is False and z['afterStop']['exits'] == [0]
assert z['afterStop']['deltas'] and all(z['afterStop']['deltas'])
assert z['instanceCount'] == 2 and z['exits'] == [0, 1]
assert z['reply']['text'] and z['reply']['usage']['promptTokens'] == 24
assert any(x['size'] == 484220320 for x in z['cacheEntries'])
block = next(i for i,x in enumerate(r['served']) if x['url'] == '/block-model')
assert not any(x['url'] == '/model.gguf' for x in r['served'][block + 1:])
print('Real native stream abort retires once; new provider engine reloads model cache and generates without another model request')
assert sum('Multithread enabled: true, pthreadPoolSize: 4' in x['text'] for x in r['console']) == 2
