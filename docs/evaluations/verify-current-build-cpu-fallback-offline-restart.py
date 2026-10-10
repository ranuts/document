import hashlib
import json
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-current-build-cpu-fallback-offline-restart.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['closedSeedContext']
assert r['probeSHA256']==hashlib.sha256((p/'probe-current-build-cpu-fallback-offline-restart.mjs').read_bytes()).hexdigest()
assert r['seedEngine']=='CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
for key in ['seedResources','offlineResources']:assert any(x.endswith('/assets/'+r['currentPlugin']) for x in r[key])
assert len(r['rows'])==1
x=r['rows'][0]
assert x['browserOnline'] is False and x['coldState']['isolated']
assert '/sw.js' in x['coldState']['controller'] and x['engine']==r['seedEngine']
assert not x['errors'] and x['previews']==0 and 'Hello' in x['reply'] and x['stats']
assert x['before']==x['after']==x['undo']==x['redo'] and x['undoExact'] and x['redoExact']
assert x['selectedProvider']=='webllm' and x['gpuUnavailable'] is True
assert x['modelWorkers'] and all(w.startswith('blob:http://127.0.0.1:5193/') for w in x['modelWorkers'])
# WebLLM stream interception does not observe the CPU protocol.
assert x['inputs']==[]
assert all('127.0.0.1:5193' in y['url'] and not y['hasBody'] for y in r['offlineRequests'])
print('Current plugin loaded across cached offline browser restart; automatic CPU fallback stream and no observed external requests')
