import json,hashlib
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-gpu-init-failure-cpu-chat.json').read_text())
assert r['status']=='completed' and not r['errors'] and len(r['rows'])==1
assert r['probeSHA256']==hashlib.sha256((p/'probe-gpu-init-failure-cpu-chat.mjs').read_bytes()).hexdigest()
assert any(s.endswith('/assets/'+r['currentPlugin']) for s in r['seedResources'])
x=r['rows'][0]
assert x['gpuPresent'] and x['failedGpuLoads']==1 and x['gpuTerminations']>=1
assert x['selectedProvider']=='webllm' and x['engine']=='CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert x['coldState']['isolated'] and x['browserOnline']
assert not x['errors'] and not x['previews'] and x['reply'] and x['stats']
assert x['before']==x['after']==x['undo']==x['redo']
assert any(s.startswith('blob:') for s in x['modelWorkers'])
print('Current bundle: injected GPU initialization failure, termination calls, automatic real CPU chat, no document mutation verified')
