import json,hashlib
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-cpu-sdk-chat-context-order.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['bundleUnchanged']
assert r['probeSHA256']==hashlib.sha256((p/'probe-cpu-sdk-chat-context-order.mjs').read_bytes()).hexdigest()
assert r['sdkSHA256']==hashlib.sha256((p.parent.parent/'dist/assets'/r['sdk']).read_bytes()).hexdigest()
assert r['routeHits'] and any(q.endswith('/assets/'+r['sdk']) for q in r['resources'])
assert r['engine']=='CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert len(r['cases'])==4 and len(r['results'])==8
for i,c in enumerate(r['cases']):
 a,b=r['results'][i*2:i*2+2]
 for x,v in [(a,'current'),(b,'request-first')]:
  assert all(x[k]==value for k,value in c.items()) and x['variant']==v
  assert not x['errors'] and not x['previews'] and len(x['requests'])==len(x['replies'])==1
  q=x['requests'][0]['request']
  assert q['temperature']==0 and q['max_tokens']==96 and q['top_p']==0.8 and q['stream']
 qa,qb=a['requests'][0],b['requests'][0]
 assert qa['before']==qb['before'] and qa['after']==qa['before']
 delim='\n\nUser request:\n';split=qa['before'].index(delim)
 assert qb['after']=='User request:\n'+qa['before'][split+len(delim):]+'\n\n'+qa['before'][:split]
 assert qa['request']['messages'][:-1]==qb['request']['messages'][:-1]
 assert qa['request']['messages'][-1]['content']==qa['after'] and qb['request']['messages'][-1]['content']==qb['after']
print('Actual CPU SDK: eight captured requests, identical system/parameters, exact paired user-content reorder')
