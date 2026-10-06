import hashlib,json
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-gpu-cpu-status-transition.json').read_text())
assert r['status']=='completed' and not r['errors']
assert r['probeSHA256']==hashlib.sha256((p/'probe-gpu-cpu-status-transition.mjs').read_bytes()).hexdigest()
x=r['rows'][0];states=x['backendStates']
gpu=next(i for i,s in enumerate(states) if 'Preparing' in s['text'] and 'WebGPU' in s['text'])
cpu=next(i for i,s in enumerate(states) if 'Preparing' in s['text'] and 'CPU' in s['text'])
assert gpu<cpu<len(states)-1
assert states[gpu]['title']=='Qwen3-1.7B-q4f16_1-MLC'
assert states[cpu]['title']==states[-1]['title']=='Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert states[-1]['text']==x['engine']=='CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert x['failedGpuLoads']==1 and x['gpuTerminations']>=1 and x['gpuPresent']
assert not x['errors'] and not x['previews'] and x['before']==x['after']
assert any(s.endswith('/assets/'+r['currentPlugin']) for s in r['seedResources'])
print('Actual DOM: GPU preparing -> CPU preparing -> CPU ready, exact model titles updated')
