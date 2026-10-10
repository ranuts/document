import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-combined-persistent-cache.json').read_text())
assert r['status'] == 'completed' and r['phase'] == 'verified' and not r['errors']
assert r['probeSHA256'] == hashlib.sha256((p / 'probe-cpu-combined-persistent-cache.mjs').read_bytes()).hexdigest()
z = r['result']
assert z['initialCount'] == z['cachedCount'] == {'promptTokens': 16, 'contextTokens': 256}
assert z['cachedReply']['usage']['prompt_tokens'] == 16
assert z['initialReply']['choices'][0]['message']['content'] == z['cachedReply']['choices'][0]['message']['content']
assert any(x['size'] == 484220320 for x in z['entries'])
block = next(i for i,x in enumerate(r['served']) if x['url'] == '/block-model')
assert not any(x['url'] == '/model.gguf' for x in r['served'][block + 1:])
assert len([x for x in r['served'] if x['url'] == '/model.gguf' and x['method'] == 'GET']) == 1
print('Actual Cache API model cache reload generates after model origin blocking, without second model request')
