import json,hashlib
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-cpu-system-sampling-diagnostic.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['bundleUnchanged']
assert r['probeSHA256']==hashlib.sha256((p/'probe-cpu-system-sampling-diagnostic.mjs').read_bytes()).hexdigest()
assert r['routeHits'] and r['engine']=='CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert len(r['cases'])==4 and len(r['results'])==16
variants=['current-0','concise-0','current-04','concise-04']
for i,c in enumerate(r['cases']):
 xs=r['results'][i*4:i*4+4];baseline=None
 for x,v in zip(xs,variants):
  assert all(x[k]==val for k,val in c.items()) and x['variant']==v
  assert not x['errors'] and not x['previews'] and len(x['requests'])==len(x['replies'])==1
  z=x['requests'][0];q=z['request']
  assert z['before']==z['after'] and z['originalTemperature']==0
  assert q['temperature']==(0.4 if v.endswith('-04') else 0)
  assert q['max_tokens']==96 and q['top_p']==0.8 and q['stream']
  assert q['messages'][0]['content']==('You are concise. Answer in English.' if v.startswith('concise') else z['originalSystem'])
  if baseline is None:baseline=q['messages'][1:]
  assert q['messages'][1:]==baseline
print('16 actual CPU SDK requests: exact system/temperature factorial, unchanged user/context/top_p/token limit')
